"""Exact training preprocessing reproduction for MambaMPD inference.

Preserves the exact M4D normalization and spatial divisible-by-32 alignment:
1. Normalization: (image / 255.0 - 0.5185) / 0.197
2. Reversible padding to ensure H, W are divisible by 32 for the 4-stage VSS encoder
3. Slicing back to exact original pixel dimensions to guarantee geometric alignment
"""

import numpy as np
import torch
from typing import Tuple, Dict, Any, Optional

M4D_MEAN = 0.5185
M4D_STD = 0.1970


class ExactPreprocessor:
    """Implements exact M4D preprocessing and spatial padding/unpadding."""

    def __init__(self, mean: float = M4D_MEAN, std: float = M4D_STD):
        self.mean = mean
        self.std = std

    def prepare_tensor(
        self,
        array_3ch: np.ndarray,
        device: torch.device,
    ) -> Tuple[torch.Tensor, Dict[str, int]]:
        """Normalize and pad 3-channel (3, H, W) SAR image to divisible by 32.

        Args:
            array_3ch: numpy array of shape (3, H, W) with values in [0, 255].
            device: torch.device for model execution.

        Returns:
            tensor: torch.Tensor of shape (1, 3, H_padded, W_padded) on device.
            pad_info: Dict with 'top', 'bottom', 'left', 'right', 'orig_h', 'orig_w'.
        """
        assert array_3ch.ndim == 3 and array_3ch.shape[0] == 3, f"Expected (3, H, W), got {array_3ch.shape}"
        c, h, w = array_3ch.shape

        # Step 1: Compute required padding to make H and W divisible by 32
        pad_h = (32 - (h % 32)) % 32
        pad_w = (32 - (w % 32)) % 32

        pad_top = pad_h // 2
        pad_bottom = pad_h - pad_top
        pad_left = pad_w // 2
        pad_right = pad_w - pad_left

        # Step 2: Apply edge reflection padding
        # np.pad expects ((before_c, after_c), (before_h, after_h), (before_w, after_w))
        padded_arr = np.pad(
            array_3ch,
            ((0, 0), (pad_top, pad_bottom), (pad_left, pad_right)),
            mode="reflect",
        )

        # Step 3: Exact M4D Normalization
        # image_pre = (image / 255.0 - mean) / std
        norm_arr = (padded_arr.astype(np.float32) / 255.0 - self.mean) / self.std

        # Convert to batch tensor (1, 3, H_padded, W_padded)
        tensor = torch.from_numpy(norm_arr).unsqueeze(0).float().to(device)

        pad_info = {
            "pad_top": pad_top,
            "pad_bottom": pad_bottom,
            "pad_left": pad_left,
            "pad_right": pad_right,
            "orig_h": h,
            "orig_w": w,
            "padded_h": padded_arr.shape[1],
            "padded_w": padded_arr.shape[2],
        }

        return tensor, pad_info

    def unpad_prediction(
        self,
        pred_tensor: torch.Tensor,
        pad_info: Dict[str, int],
    ) -> np.ndarray:
        """Crop padding from prediction tensor to restore exact original dimensions.

        Args:
            pred_tensor: Tensor of shape (H_padded, W_padded) or (B, H_padded, W_padded)
            pad_info: Dict returned by prepare_tensor.

        Returns:
            2D numpy array of shape (orig_h, orig_w) perfectly aligned with input GeoTIFF.
        """
        if pred_tensor.ndim == 3:
            pred_tensor = pred_tensor[0]

        top = pad_info["pad_top"]
        left = pad_info["pad_left"]
        h = pad_info["orig_h"]
        w = pad_info["orig_w"]

        cropped = pred_tensor[top : top + h, left : left + w]
        if isinstance(cropped, torch.Tensor):
            return cropped.detach().cpu().numpy().astype(np.uint8)
        return cropped.astype(np.uint8)

    def unpad_probabilities(
        self,
        prob_tensor: torch.Tensor,
        pad_info: Dict[str, int],
    ) -> np.ndarray:
        """Crop padding from probability tensor of shape (C, H_padded, W_padded)."""
        if prob_tensor.ndim == 4:
            prob_tensor = prob_tensor[0]

        top = pad_info["pad_top"]
        left = pad_info["pad_left"]
        h = pad_info["orig_h"]
        w = pad_info["orig_w"]

        cropped = prob_tensor[:, top : top + h, left : left + w]
        if isinstance(cropped, torch.Tensor):
            return cropped.detach().cpu().numpy().astype(np.float32)
        return cropped.astype(np.float32)

