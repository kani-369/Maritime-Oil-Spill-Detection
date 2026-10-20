# Maritime Oil Spill Detection using MambaMPD

A deep-learning segmentation framework tailored for fine-grained marine oil-spill detection and classification from Synthetic Aperture Radar (SAR) remote sensing imagery, powered by Visual State Space Models (Mamba).

---

## Overview

Marine pollution monitoring via satellite SAR faces unique challenges, including low signal-to-noise ratios, spatial fragmentation, and backscatter ambiguity between genuine oil slicks and look-alikes. **MambaMPD** addresses these challenges by combining:

* **Visual State Space (VSS) Encoder**: Captures long-range dependencies and global spatial context with linear computational complexity.
* **Frequency-Aware Augmentation (FAA)**: Utilizes 2D Discrete Wavelet Transforms (DWT) to preserve high-frequency structural edges and low-frequency contextual semantics before downsampling.
* **Edge-Guided Attention (EGA)**: Injects multi-scale Laplacian boundary cues into the decoding pipeline to sharpen boundaries and reduce confusion in ambiguous regions.
* **SE-ResDecoder & Deep Supervision**: Features Squeeze-and-Excitation channel recalibration and intermediate auxiliary losses for robust gradient flow and fine detail recovery.

---

## Supported Classes (M4D SAR Benchmark)

The model segments SAR imagery into **5 semantic classes**:
1. `sea_surface` (Background ocean)
2. `oil_spill` (Confirmed crude / petroleum slicks)
3. `look_alike` (Biogenic slicks, low-wind areas, internal waves)
4. `ship` (Vessels and maritime platforms)
5. `land` (Coastlines and terrestrial landmass)

---

## Installation

### 1. Requirements

Ensure you have Python 3.10+ and a CUDA-capable GPU (NVIDIA GPU recommended):

```bash
pip install -r requirements.txt
```

### 2. Selective-Scan Kernels (`mamba-ssm`)

The VSS backbone requires the CUDA-accelerated selective-scan kernels:

```bash
pip install causal-conv1d>=1.4.0
pip install mamba-ssm>=2.2.0 --no-build-isolation
```

### 3. Pretrained Backbone Weights

The ImageNet-pretrained VMamba-Tiny encoder weights should be placed at:
```text
pretrained/vssmtiny_dp01_ckpt_epoch_292.pth
```

---

## Dataset Structure

Organize the **M4D SAR Oil Spill Dataset** in the following directory layout:

```text
<M4D_ROOT>/
├── train/
│   ├── images/        # SAR intensity images (*.jpg)
│   └── labels_1D/     # Single-channel ground truth masks (*.png, values 0-4)
└── test/
    ├── images/        # Test SAR images (*.jpg)
    └── labels_1D/     # Test ground truth masks (*.png)
```

---

## Usage

### Training

To train MambaMPD on the M4D dataset from the ImageNet-pretrained checkpoint:

```bash
python train.py \
    --dir_dataset "/path/to/M4D" \
    --pretrained_ckpt pretrained/vssmtiny_dp01_ckpt_epoch_292.pth \
    --batch_size 8 \
    --num_epochs 100 \
    --learning_rate 0.001 \
    --which_optimizer sgd
```

#### Training on Memory-Constrained GPUs (e.g. Google Colab / Kaggle T4):
If running on a GPU with limited VRAM (<= 16 GB), use gradient accumulation and activation checkpointing:

```bash
python train.py \
    --dir_dataset "/path/to/M4D" \
    --pretrained_ckpt pretrained/vssmtiny_dp01_ckpt_epoch_292.pth \
    --batch_size 2 \
    --grad_accum_steps 4 \
    --activation_checkpointing 1 \
    --num_epochs 100
```

#### Resume Training:
```bash
python train.py --dir_dataset "/path/to/M4D" --resume
```

---

### Evaluation

To evaluate a trained checkpoint on the test set and compute pixel accuracy, per-class IoU, and mean IoU:

```bash
python eval.py \
    --dir_dataset "/path/to/M4D" \
    --file_model_weights mambampd/mambampd_best.pt \
    --dir_save_preds preds/
```

Predicted colorized segmentation masks will be saved to `preds/masks/`.

---

### Ablation Studies

You can individually toggle the core architectural modules:

```bash
python train.py ... --use_faa 0            # Without Frequency-Aware Augmentation
python train.py ... --use_ega 0            # Without Edge-Guided Attention
python train.py ... --deep_supervision 0   # Without Deep Supervision
```
