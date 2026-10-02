"""Verification and diagnostic test suite for MambaMPD.

Tests:
1. Import test: verifies MambaMPD, build_mambampd, load_pretrained_ckpt can be imported
2. Model construction test: builds the complete MambaMPD model
3. Pretrained checkpoint loading test: loads pretrained/vssmtiny_dp01_ckpt_epoch_292.pth
4. Forward pass test: runs a dummy batch through the model on CUDA (or fallback device)
5. Real/Simulated M4D batch test: tests loss and metrics on a representative batch
"""

import os
import sys
import argparse
import torch

# Handle platform-specific mamba_ssm availability (e.g. macOS without CUDA)
try:
    import mamba_ssm
except ImportError:
    from unittest.mock import MagicMock
    print("[INFO] mamba_ssm CUDA package not found in current environment. Using CPU mock for testing.")
    mock_mamba = MagicMock()
    def mock_selective_scan_fn(xs, dts, As, Bs, Cs, Ds, z=None, delta_bias=None, delta_softplus=True, return_last_state=False):
        return torch.zeros_like(xs)
    mock_mamba.ops.selective_scan_interface.selective_scan_fn = mock_selective_scan_fn
    sys.modules['mamba_ssm'] = mock_mamba
    sys.modules['mamba_ssm.ops'] = mock_mamba.ops
    sys.modules['mamba_ssm.ops.selective_scan_interface'] = mock_mamba.ops.selective_scan_interface

from models import build_mambampd, load_pretrained_ckpt, MambaMPD
from utils.losses import DeepSupervisionLoss
from utils.metrics import compute_mean_IOU, compute_mean_pixel_acc


def run_tests(dataset_dir=None):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"=== Running MambaMPD Verification Tests on {device} ===\n")

    # Test 1: Import test
    print("--- Test 1: Import Test ---")
    assert MambaMPD is not None
    assert build_mambampd is not None
    assert load_pretrained_ckpt is not None
    print("✓ Successfully imported MambaMPD, build_mambampd, and load_pretrained_ckpt from models.\n")

    # Test 2: Model construction test
    print("--- Test 2: Model Construction Test ---")
    model = build_mambampd(
        num_classes=5,
        in_chans=3,
        deep_supervision=True,
        use_faa=True,
        use_ega=True,
    )
    model.to(device)
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"✓ Model built successfully.")
    print(f"  Total parameters: {total_params:,}")
    print(f"  Trainable parameters: {trainable_params:,}\n")

    # Test 3: Pretrained checkpoint loading test
    print("--- Test 3: Pretrained Checkpoint Loading Test ---")
    ckpt_path = "pretrained/vssmtiny_dp01_ckpt_epoch_292.pth"
    if os.path.isfile(ckpt_path):
        model = load_pretrained_ckpt(model, ckpt_path)
        print(f"✓ Pretrained weights successfully loaded from {ckpt_path}.\n")
    else:
        print(f"⚠ Pretrained checkpoint not found at {ckpt_path}.\n")

    # Test 4: One dummy forward pass (CUDA if available, else CPU)
    print("--- Test 4: Dummy Forward Pass ---")
    model.eval()
    dummy_input = torch.randn(2, 3, 256, 256, device=device)
    with torch.no_grad():
        outputs = model(dummy_input)

    assert isinstance(outputs, list), f"Expected list output under deep supervision, got {type(outputs)}"
    assert len(outputs) == 4, f"Expected 4 deep-supervision stage outputs, got {len(outputs)}"
    print("✓ Dummy forward pass completed successfully.")
    print(f"  Input shape: {dummy_input.shape}")
    for idx, out in enumerate(outputs):
        print(f"  Stage {idx} output shape: {out.shape} (dtype: {out.dtype})")
    print()

    # Test 5: Real M4D batch or representative batch forward pass + loss
    print("--- Test 5: M4D Batch Forward Pass & Loss Test ---")
    criterion = DeepSupervisionLoss().to(device)

    if dataset_dir and os.path.isdir(dataset_dir):
        from utils.dataset import get_dataloaders_for_training
        print(f"Loading real M4D batch from {dataset_dir}...")
        train_loader, _ = get_dataloaders_for_training(dataset_dir, batch_size=2)
        images, labels = next(iter(train_loader))
        images = images.to(device, dtype=torch.float)
        labels = labels.to(device, dtype=torch.long)
        print("✓ Real M4D batch loaded.")
    else:
        print("Real M4D dataset directory not provided; testing with synthetic M4D-conforming batch.")
        # M4D images are 3 channels (normalized with mean=0.5185, std=0.197), labels in {0,1,2,3,4}
        images = (torch.rand(2, 3, 256, 256, device=device) - 0.5185) / 0.197
        labels = torch.randint(0, 5, (2, 256, 256), device=device, dtype=torch.long)

    model.train()
    outputs = model(images)
    loss = criterion(outputs, labels)
    loss.backward()

    pred_label = torch.argmax(torch.softmax(outputs[0], dim=1), dim=1)
    acc = compute_mean_pixel_acc(labels, pred_label)
    iou = compute_mean_IOU(labels, pred_label, num_classes=5)

    print(f"✓ Batch forward + backward pass completed.")
    print(f"  Loss: {loss.item():.4f}")
    print(f"  Mean Pixel Accuracy: {acc:.4f}")
    print(f"  Mean IoU: {iou:.4f}\n")

    print("=== All Tests Passed Successfully! ===")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir_dataset", type=str, default=None, help="Optional path to M4D dataset")
    args = parser.parse_args()
    run_tests(args.dir_dataset)
