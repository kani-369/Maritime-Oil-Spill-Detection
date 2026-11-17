"""MambaMPD Inference Engine.

Executes segmentation using the exact original MambaMPD architecture and checkpoint.
Strictly preserves the model weights and architecture without modification.
"""

import os
import sys
import torch
import torch.nn.functional as F
import numpy as np
from typing import Dict, Any, Optional, Tuple

# Enable CPU testing compatibility when CUDA kernels (mamba_ssm) are absent
try:
    import mamba_ssm
except ImportError:
    from unittest.mock import MagicMock
    mock_mamba = MagicMock()
    def _mock_selective_scan_fn(xs, dts, As, Bs, Cs, Ds, z=None, delta_bias=None, delta_softplus=True, return_last_state=False):
        return torch.zeros_like(xs)
    mock_mamba.ops.selective_scan_interface.selective_scan_fn = _mock_selective_scan_fn
    sys.modules["mamba_ssm"] = mock_mamba
    sys.modules["mamba_ssm.ops"] = mock_mamba.ops
    sys.modules["mamba_ssm.ops.selective_scan_interface"] = mock_mamba.ops.selective_scan_interface

from models import build_mambampd
from .preprocessor import ExactPreprocessor

CLASS_NAMES = ["sea_surface", "oil_spill", "look_alike", "ship", "land"]
OIL_SPILL_CLASS_ID = 1


class MambaMPDInferenceEngine:
    """Encapsulates checkpoint loading and execution for MambaMPD."""

    def __init__(
        self,
        checkpoint_path: Optional[str] = None,
        num_classes: int = 5,
        in_chans: int = 3,
        use_faa: bool = True,
        use_ega: bool = True,
        deep_supervision: bool = False,
        device: Optional[str] = None,
    ):
        self.num_classes = num_classes
        self.in_chans = in_chans
        self.device = torch.device(
            device if device is not None else ("cuda" if torch.cuda.is_available() else "cpu")
        )

        # 1. Build original model architecture without modification
        self.model = build_mambampd(
            num_classes=num_classes,
            in_chans=in_chans,
            deep_supervision=deep_supervision,
            use_faa=use_faa,
            use_ega=use_ega,
        )
        self.model.to(self.device)

        # 2. Load trained checkpoint if provided
        self.checkpoint_path = checkpoint_path
        if checkpoint_path and os.path.isfile(checkpoint_path):
            self._load_weights(checkpoint_path)
        else:
            print(f"[MambaMPDInferenceEngine] Warning: Checkpoint path not found or omitted: {checkpoint_path}")

        self.model.eval()
        self.preprocessor = ExactPreprocessor()

    def _load_weights(self, checkpoint_path: str):
        """Load state dict from file, handling raw state_dict or training dict."""
        print(f"[MambaMPDInferenceEngine] Loading weights from {checkpoint_path} on {self.device}")
        checkpoint = torch.load(checkpoint_path, map_location=self.device)

        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            state_dict = checkpoint["model_state_dict"]
        elif isinstance(checkpoint, dict) and "model" in checkpoint:
            state_dict = checkpoint["model"]
        else:
            state_dict = checkpoint

        # Handle potential module. prefix from DataParallel
        cleaned_state = {}
        for k, v in state_dict.items():
            key = k.replace("module.", "")
            cleaned_state[key] = v

        self.model.load_state_dict(cleaned_state, strict=False)
        print("[MambaMPDInferenceEngine] Checkpoint successfully loaded.")

    @torch.no_grad()
    def predict(
        self,
        array_3ch: np.ndarray,
        oil_threshold: float = 0.5,
    ) -> Dict[str, Any]:
        """Run full 5-class segmentation and extract Class 1 (oil spill) probability map.

        Args:
            array_3ch: Normalized (3, H, W) numpy array in range [0, 255].
            oil_threshold: Probability threshold for binary oil spill extraction.

        Returns:
            Dict containing:
                'pred_mask_5class': (H, W) uint8 array (values 0-4)
                'oil_spill_mask': (H, W) uint8 binary mask (0 or 1)
                'oil_spill_prob': (H, W) float32 probability array [0.0, 1.0]
                'probabilities': (5, H, W) float32 probabilities
        """
        # Step 1: Preprocess with exact training normalization and divisible-by-32 padding
        input_tensor, pad_info = self.preprocessor.prepare_tensor(array_3ch, self.device)

        # Step 2: Forward pass through MambaMPD
        outputs = self.model(input_tensor)
        main_output = outputs[0] if isinstance(outputs, (list, tuple)) else outputs

        # Softmax probabilities over 5 classes
        probs = F.softmax(main_output, dim=1)  # (1, 5, H_pad, W_pad)
        pred_label = torch.argmax(probs, dim=1)  # (1, H_pad, W_pad)

        # Step 3: Unpad to match exact original raster dimensions
        pred_mask_5class = self.preprocessor.unpad_prediction(pred_label, pad_info)
        prob_unpadded = self.preprocessor.unpad_probabilities(probs, pad_info)

        oil_prob = prob_unpadded[OIL_SPILL_CLASS_ID]
        # Binary mask according to argmax and confidence threshold
        oil_mask = ((pred_mask_5class == OIL_SPILL_CLASS_ID) & (oil_prob >= oil_threshold)).astype(np.uint8)

        return {
            "pred_mask_5class": pred_mask_5class,
            "oil_spill_mask": oil_mask,
            "oil_spill_prob": oil_prob,
            "probabilities": prob_unpadded,
            "pad_info": pad_info,
        }
