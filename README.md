# DiagnoVision 🫁

**AI-Assisted Pneumonia Screening from Pediatric Chest X-Rays**

A deep learning tool that classifies pediatric chest X-ray images as **NORMAL** or **PNEUMONIA** using PyTorch and transfer learning. Built as a college project.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Environment Setup](#environment-setup)
- [Dataset](#dataset)
- [Data Audit Findings](#data-audit-findings)
- [Re-split Strategy](#re-split-strategy)
- [Data Pipeline](#data-pipeline)
- [Model Setup](#model-setup)
- [Training Loop](#training-loop)
- [Test Set Evaluation](#test-set-evaluation)
- [Single Image Prediction](#single-image-prediction)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)

---

## Project Overview

| Item | Detail |
|------|--------|
| **Task** | Binary classification — Normal vs Pneumonia |
| **Input** | Pediatric chest X-ray images (grayscale, variable sizes) |
| **Framework** | PyTorch 2.6.0 + CUDA 12.4 |
| **GPU** | NVIDIA GeForce RTX 4050 Laptop GPU (6 GB VRAM) |
| **Dataset** | Chest X-Ray Images (Pneumonia) — Kaggle |

---

## Environment Setup

**Python**: 3.13.9 (Anaconda base — `C:\anaconda\python.exe`)

| Library | Version |
|---------|---------|
| PyTorch | 2.6.0+cu124 |
| TorchVision | 0.21.0+cu124 |
| NumPy | 2.4.4 |
| Pandas | 2.3.3 |
| Matplotlib | 3.10.6 |
| Scikit-learn | 1.7.2 |
| OpenCV | 4.13.0 |
| Pillow | 12.2.0 |
| CUDA | 12.4 |
| cuDNN | 90100 |

**Run command** (always use Anaconda Python):
```bash
C:\anaconda\python.exe <script_name>.py
```

---

## Dataset

**Source**: [Chest X-Ray Images (Pneumonia)](https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia) — Kaggle

- 5,856 pediatric chest X-ray images
- Binary classes: `NORMAL` and `PNEUMONIA`
- Original structure: `chest_xray/{train,test,val}/{NORMAL,PNEUMONIA}/`
- Image format: JPEG, grayscale, variable sizes (1072×768 to 2090×1858)

---

## Data Audit Findings

> Audit performed by `data_audit.py` — scanned all 5,856 images.

### Original Split Counts

| Split | NORMAL | PNEUMONIA | Total |
|-------|-------:|----------:|------:|
| train | 1,341 | 3,875 | 5,216 |
| val | 8 | 8 | 16 |
| test | 234 | 390 | 624 |
| **TOTAL** | **1,583** | **4,273** | **5,856** |

### Key Issues Found

| Issue | Severity | Detail |
|-------|----------|--------|
| **Class imbalance** | ⚠️ Medium | PNEUMONIA is 2.89× more than NORMAL (74.3% vs 25.7%) |
| **Tiny validation set** | 🔴 High | Only 16 images — too few for reliable metric estimation |
| **Variable image sizes** | ℹ️ Info | Ranges from 1072×768 to 2090×1858 — needs resizing |
| **Corrupted files** | ✅ None | 0 corrupted images out of 5,856 |

### Sample X-Ray Grid

| | Description |
|---|---|
| **NORMAL** (top row) | Clear lung fields, visible rib detail, no consolidation |
| **PNEUMONIA** (bottom row) | Visible opacities/haziness consistent with pneumonia |

Sample grid saved at: `sample_grid.png`

---

## Re-split Strategy

> Original val set (16 images) was too small. Performed by `resplit_data.py`.

**Approach:**
1. Merged original `train/` (5,216) + `val/` (16) into a single pool of 5,232 images
2. Applied **stratified 85/15 split** (preserving class ratios) with `random_seed=42`
3. Copied files to new directory `chest_xray_split/` — **original data untouched**
4. Test set copied as-is (held-out, never used during training)

### New Split Counts (used for training)

| Split | NORMAL | PNEUMONIA | Total | Note |
|-------|-------:|----------:|------:|------|
| train | 1,147 | 3,300 | 4,447 | — |
| val | 202 | 583 | **785** | was 16 → 785 (49× larger) |
| test | 234 | 390 | 624 | untouched |
| **TOTAL** | **1,583** | **4,273** | **5,856** | — |

### Stratification Verified

| Set | NORMAL % | PNEUMONIA % | P:N Ratio |
|-----|----------|-------------|-----------|
| Train | 25.8% | 74.2% | 2.88:1 |
| Val | 25.7% | 74.3% | 2.89:1 |

**Data path for all future training**: `D:\DiagnoVision\chest_xray_split\`

---

## Data Pipeline

> Built by `data_pipeline.py` — tested and verified.

### Preprocessing

| Setting | Value |
|---------|-------|
| Input size | 224 x 224 (resized from variable originals) |
| Channels | 3 (grayscale auto-converted to RGB by ImageFolder) |
| Normalization | ImageNet mean `[0.485, 0.456, 0.406]` / std `[0.229, 0.224, 0.225]` |
| Batch size | 32 |
| Num workers | 0 (Windows spawn-based multiprocessing requires this) |

### Train Augmentations

| Augmentation | Parameter |
|---|---|
| Random Rotation | +/- 10 degrees |
| Random Horizontal Flip | p = 0.5 |
| Random Resized Crop | scale 85-100%, ratio 0.9-1.1 |

Val/Test: resize + normalize only (no augmentation).

### Class Imbalance Strategy

**Chosen: Class-Weighted CrossEntropyLoss** (not weighted sampling)

| Class | Weight |
|-------|-------|
| NORMAL | 1.9385 (higher penalty for misclassification) |
| PNEUMONIA | 0.6738 |

**Why weighted loss over weighted sampling:**
1. WeightedRandomSampler oversamples minority class — with only ~1,147 NORMAL images, this risks overfitting
2. Weighted loss penalizes NORMAL misclassification more, achieving balance without repeating images
3. Every image seen exactly once per epoch — simpler, no sampler/shuffle conflicts

### Batch Verification

| Loader | Shape | Dtype | Value Range |
|--------|-------|-------|-------------|
| Train | `[32, 3, 224, 224]` | float32 | [-2.118, 2.623] |
| Val | `[32, 3, 224, 224]` | float32 | [-2.118, 2.640] |
| Test | `[32, 3, 224, 224]` | float32 | [-2.118, 2.640] |

GPU transfer test: **PASSED** (tensors on `cuda:0`)

---

## Model Setup

> Built by `model_setup.py` — tested and verified.

### Architecture

| Component | Detail |
|-----------|--------|
| **Base model** | EfficientNet-B0 (pretrained on ImageNet-1K) |
| **Total params** | 4,664,446 |
| **Trainable params** | 3,812,638 (81.7%) |
| **Frozen params** | 851,808 (18.3%) |

### Freeze Strategy

| Layer | Status | Params |
|-------|--------|-------:|
| features[0-5] | FROZEN | 851,808 |
| features[6] | TRAINABLE | 2,026,348 |
| features[7] | TRAINABLE | 717,232 |
| features[8] | TRAINABLE | 412,160 |
| classifier | TRAINABLE | 656,898 |

**Rationale:** Freezing early layers preserves low-level features (edges, textures) learned from ImageNet. Deeper layers (6-8) are unfrozen to adapt to X-ray-specific patterns.

### Custom Classifier Head

```
Dropout(0.3) → Linear(1280, 512) → ReLU → Dropout(0.2) → Linear(512, 2)
```

Output: 2 classes (NORMAL=0, PNEUMONIA=1)

### VRAM Verification (RTX 4050, 6 GB)

| Metric | Value |
|--------|------:|
| Model on GPU | 18.0 MB |
| Peak VRAM (inference) | 357.9 MB |
| Peak VRAM (training) | 366.0 MB |
| Total GPU VRAM | 6,140 MB |
| **Utilization** | **6.0%** |
| **Headroom** | **5,774 MB** |

**Verdict:** Batch size 32 fits **very comfortably** -- only 6% VRAM utilization.

---

## Training Loop

> Built by `train.py` -- 2-epoch test run verified.

### Hyperparameters

| Parameter | Value |
|-----------|-------|
| Optimizer | Adam |
| Learning rate | 1e-4 |
| Weight decay (L2) | 1e-4 |
| Batch size | 32 |
| Loss function | CrossEntropyLoss (class-weighted) |
| LR Scheduler | ReduceLROnPlateau (factor=0.5, patience=3) |
| Early stopping | patience=5 epochs |

### Features
- **Class-weighted loss**: NORMAL=1.9385, PNEUMONIA=0.6738 (handles imbalance)
- **Best checkpoint**: saved when val loss improves (`checkpoints/best_model.pth`)
- **Last checkpoint**: saved every run (`checkpoints/last_model.pth`)
- **Early stopping**: halts training if val loss doesn't improve for 5 epochs
- **Reproducibility**: fixed seeds for PyTorch, NumPy, CUDA

### Full Training Results

Early stopping triggered at **epoch 8** (best at epoch 3).

| Epoch | Train Loss | Train Acc | Val Loss | Val Acc | LR | Status |
|------:|-----------:|----------:|---------:|--------:|---:|--------|
| 1 | 0.2452 | 89.40% | 0.2363 | 90.45% | 1e-4 | BEST |
| 2 | 0.1112 | 95.65% | 0.1626 | 92.61% | 1e-4 | BEST |
| **3** | **0.0882** | **96.54%** | **0.0900** | **96.43%** | **1e-4** | **BEST** |
| 4 | 0.0708 | 97.33% | 0.1883 | 93.12% | 1e-4 | |
| 5 | 0.0571 | 97.80% | 0.1271 | 95.03% | 1e-4 | |
| 6 | 0.0512 | 97.80% | 0.1460 | 94.65% | 1e-4 | |
| 7 | 0.0596 | 97.64% | 0.1246 | 95.16% | 5e-5 | LR reduced |
| 8 | 0.0458 | 98.19% | 0.1394 | 95.41% | 5e-5 | EARLY STOP |

**Summary:**
- **Best val accuracy: 96.43%** (epoch 3)
- **Best val loss: 0.0900** (epoch 3)
- **Peak VRAM**: 418 MB / 6,140 MB (6.8%)
- **Training time**: ~14 minutes total (8 epochs)
- After epoch 3, train loss keeps dropping but val loss rises — classic **overfitting** signal, early stopping saved us

### Training Curves

See `training_curves.png` for loss and accuracy plots.

---

## Test Set Evaluation

> Evaluated by `evaluate.py` on 624 held-out test images.

### Overall Metrics

| Metric | Value |
|--------|------:|
| **Test Accuracy** | **89.10%** |
| Precision (Pneumonia) | 86.59% |
| Recall (Pneumonia) | 97.69% |
| **F1 Score (Pneumonia)** | **91.81%** |

### Clinical Metrics

| Metric | Value | Meaning |
|--------|------:|--------|
| **Sensitivity** | **97.69%** | Catches 97.7% of pneumonia cases |
| Specificity | 74.79% | Correctly identifies 74.8% of normal cases |
| PPV | 86.59% | 86.6% of positive predictions are correct |
| **NPV** | **95.11%** | 95.1% of negative predictions are correct |
| False Negative Rate | 2.31% | Misses only 2.3% of pneumonia cases |
| False Positive Rate | 25.21% | 25.2% of normals flagged as pneumonia |

### Confusion Matrix

|  | Predicted NORMAL | Predicted PNEUMONIA |
|--|:---:|:---:|
| **Actual NORMAL** (234) | 175 (TN) | 59 (FP) |
| **Actual PNEUMONIA** (390) | 9 (FN) | 381 (TP) |

### Per-Class Report

| Class | Precision | Recall | F1-Score | Support |
|-------|----------:|-------:|---------:|--------:|
| NORMAL | 95.11% | 74.79% | 83.73% | 234 |
| PNEUMONIA | 86.59% | 97.69% | 91.81% | 390 |
| **Weighted Avg** | **89.79%** | **89.10%** | **88.78%** | **624** |

> **Key insight:** The model has very high sensitivity (97.69%) -- it almost never misses a pneumonia case (only 9 out of 390). The trade-off is some false positives (59 normals flagged as pneumonia), which is acceptable for a screening tool where missing a sick patient is far worse than an extra referral.

Results saved in `results/` folder: `test_metrics.json`, `test_report.txt`, `confusion_matrix.png`

---

## Single Image Prediction

> Use `predict.py` to classify any chest X-ray image.

```bash
C:\anaconda\python.exe predict.py <path_to_xray_image>
```

**Example outputs:**

```
  Image: test/NORMAL/IM-0001-0001.jpeg
  Prediction:   NORMAL
  Confidence:   79.9%
  NORMAL: 79.9%  <<  |  PNEUMONIA: 20.1%
  [OK] No pneumonia indicators detected.
```

```
  Image: test/PNEUMONIA/person1_virus_6.jpeg
  Prediction:   PNEUMONIA
  Confidence:   100.0%
  NORMAL: 0.0%  |  PNEUMONIA: 100.0%  <<
  [!] PNEUMONIA DETECTED -- Recommend clinical follow-up.
```

---

## Project Structure

```
DiagnoVision/
├── chest_xray/              # Original dataset (untouched)
│   ├── train/
│   │   ├── NORMAL/
│   │   └── PNEUMONIA/
│   ├── val/
│   │   ├── NORMAL/
│   │   └── PNEUMONIA/
│   └── test/
│       ├── NORMAL/
│       └── PNEUMONIA/
├── chest_xray_split/        # Re-split dataset (used for training)
│   ├── train/               # 4,447 images (85%)
│   │   ├── NORMAL/          # 1,147
│   │   └── PNEUMONIA/       # 3,300
│   ├── val/                 # 785 images (15%)
│   │   ├── NORMAL/          # 202
│   │   └── PNEUMONIA/       # 583
│   └── test/                # 624 images (held-out)
│       ├── NORMAL/          # 234
│       └── PNEUMONIA/       # 390
├── verify_env.py            # Step 1: Environment verification
├── data_audit.py            # Step 2: Data audit & corruption check
├── resplit_data.py          # Step 3: Stratified re-split
├── data_pipeline.py         # Step 4: Dataset, DataLoader, transforms
├── model_setup.py           # Step 5: EfficientNet-B0 setup & VRAM check
├── train.py                 # Step 6/7: Training loop with early stopping
├── evaluate.py              # Step 8: Test set evaluation & metrics
├── predict.py               # Single image prediction tool
├── checkpoints/             # Saved model checkpoints
│   ├── best_model.pth       # Best val loss checkpoint
│   └── last_model.pth       # Latest epoch checkpoint
├── results/                 # Evaluation results
│   ├── test_metrics.json    # All metrics as structured data
│   ├── test_report.txt      # Human-readable report
│   └── confusion_matrix.png # Confusion matrix heatmap
├── sample_grid.png          # Sample X-ray grid from audit
├── training_curves.png      # Loss & accuracy plots
└── README.md                # This file
```

---

## How to Run

```bash
# Step 1: Verify environment
C:\anaconda\python.exe verify_env.py

# Step 2: Audit the dataset
C:\anaconda\python.exe data_audit.py

# Step 3: Re-split train/val (creates chest_xray_split/)
C:\anaconda\python.exe resplit_data.py

# Step 4: Test data pipeline (loads one batch, verifies GPU)
C:\anaconda\python.exe data_pipeline.py

# Step 5: Model setup & VRAM check
C:\anaconda\python.exe model_setup.py

# Step 6/7: Full training (early stopping enabled)
C:\anaconda\python.exe train.py

# Step 8: Evaluate on held-out test set
C:\anaconda\python.exe evaluate.py

# Predict on a single X-ray image
C:\anaconda\python.exe predict.py <path_to_xray_image>
```

---

> **Status**: Project complete! Model trained with **96.43% val accuracy**, evaluated at **89.10% test accuracy** with **97.69% sensitivity**. Single image prediction available via `predict.py`.
