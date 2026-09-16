# DiagnoVision 🫁

**AI-Assisted Pneumonia Screening from Pediatric Chest X-Rays**

> ⚠️ **This is a screening aid, not a diagnostic tool.** DiagnoVision has not been validated for clinical use and must not be used to make or inform medical decisions. All outputs should be reviewed by a qualified clinician.

DiagnoVision is a deep learning pipeline that screens pediatric frontal chest X-ray images for signs consistent with pneumonia, classifying each image as **NORMAL** or **PNEUMONIA** using PyTorch and transfer learning (EfficientNet-B0). The tool is scoped to **pediatric frontal chest X-rays only** (dataset ages 1–5, Guangzhou Women and Children's Medical Center) — it is not validated on adult chest X-rays, lateral views, or images from other clinical settings. Built as a college project.

---

## Table of Contents

- [Pipeline Overview](#pipeline-overview)
- [Environment Setup](#environment-setup)
- [Dataset](#dataset)
- [Data Audit Findings](#data-audit-findings)
- [Re-split Strategy](#re-split-strategy)
- [Data Pipeline](#data-pipeline)
- [Model Setup](#model-setup)
- [Training Loop](#training-loop)
- [Gatekeeper Classifier](#gatekeeper-classifier)
- [Confidence Threshold](#confidence-threshold)
- [Test Set Evaluation](#test-set-evaluation)
- [Grad-CAM Visualizations](#grad-cam-visualizations)
- [Single Image Prediction](#single-image-prediction)
- [How to Run (All Scripts)](#how-to-run-all-scripts)
- [Project Structure](#project-structure)
- [Known Limitations](#known-limitations)

---

## Pipeline Overview

Every prediction made by DiagnoVision follows this fixed sequence:

```
Input image
    │
    ▼
[1] Gatekeeper Classifier (MobileNetV3-Small)
    └─ Is this a frontal chest X-ray?
       ├─ NO  → REJECTED — pneumonia screening aborted
       └─ YES ▼
[2] Pneumonia Classifier (EfficientNet-B0)
    └─ NORMAL or PNEUMONIA?
       │
       ▼
[3] Confidence Check
    ├─ < 70%  → UNCERTAIN — recommend professional review
    ├─ PNEUMONIA + ≥ 70% → Signs consistent with pneumonia
    └─ NORMAL  + ≥ 70% → No pneumonia indicators detected
```

The gatekeeper runs first, automatically, inside `predict.py`. If the image is not a frontal chest X-ray, the pneumonia model never runs — preventing the tool from forcing a label onto an unrelated image.

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

**Always run scripts via Anaconda Python:**
```bash
C:\anaconda\python.exe <script_name>.py
```

---

## Dataset

**Source**: [Chest X-Ray Images (Pneumonia)](https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia) — Kaggle

- 5,856 pediatric chest X-ray images
- Patient ages: 1–5 years (Guangzhou Women and Children's Medical Center)
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

---

## Re-split Strategy

> Performed by `resplit_data.py`.

The original validation set (16 images) was too small for reliable metric estimation.

**Approach:**
1. Merged original `train/` (5,216) + `val/` (16) into a pool of 5,232 images
2. Applied **stratified 85/15 split** (preserving class ratios) with `random_seed=42`
3. Copied to new directory `chest_xray_split/` — **original data untouched**
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

---

## Data Pipeline

> Built by `data_pipeline.py`.

### Preprocessing

| Setting | Value |
|---------|-------|
| Input size | 224 × 224 |
| Channels | 3 (grayscale auto-converted to RGB) |
| Normalization | ImageNet mean `[0.485, 0.456, 0.406]` / std `[0.229, 0.224, 0.225]` |
| Batch size | 32 |
| Num workers | 0 (Windows spawn-based multiprocessing) |

### Train Augmentations

| Augmentation | Parameter |
|---|---|
| Random Rotation | ± 10 degrees |
| Random Horizontal Flip | p = 0.5 |
| Random Resized Crop | scale 85–100%, ratio 0.9–1.1 |

Val/Test: resize + normalize only (no augmentation).

### Class Imbalance Strategy

**Chosen: Class-Weighted CrossEntropyLoss**

| Class | Weight |
|-------|--------|
| NORMAL | 1.9385 (higher penalty for misclassification) |
| PNEUMONIA | 0.6738 |

---

## Model Setup

> Built by `model_setup.py`.

### Architecture

| Component | Detail |
|-----------|--------|
| **Base model** | EfficientNet-B0 (pretrained on ImageNet-1K) |
| **Total params** | 4,664,446 |
| **Trainable params** | 3,812,638 (81.7%) |
| **Frozen params** | 851,808 (18.3%) — early feature layers |

### Freeze Strategy

| Layer | Status | Params |
|-------|--------|-------:|
| features[0-5] | FROZEN | 851,808 |
| features[6] | TRAINABLE | 2,026,348 |
| features[7] | TRAINABLE | 717,232 |
| features[8] | TRAINABLE | 412,160 |
| classifier | TRAINABLE | 656,898 |

Freezing early layers preserves low-level features (edges, textures) learned from ImageNet. Deeper layers (6–8) are unfrozen to adapt to X-ray-specific patterns.

### Custom Classifier Head

```
Dropout(0.3) → Linear(1280, 512) → ReLU → Dropout(0.2) → Linear(512, 2)
```

Output: 2 classes (NORMAL=0, PNEUMONIA=1)

### VRAM (RTX 4050, 6 GB)

| Metric | Value |
|--------|------:|
| Model on GPU | 18.0 MB |
| Peak VRAM (training) | 366.0 MB |
| **Utilization** | **6.0%** |

---

## Training Loop

> Built by `train.py`.

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

### Full Training Results

Early stopping triggered at **epoch 8** (best checkpoint at epoch 3).

| Epoch | Train Loss | Train Acc | Val Loss | Val Acc | Status |
|------:|-----------:|----------:|---------:|--------:|--------|
| 1 | 0.2452 | 89.40% | 0.2363 | 90.45% | BEST |
| 2 | 0.1112 | 95.65% | 0.1626 | 92.61% | BEST |
| **3** | **0.0882** | **96.54%** | **0.0900** | **96.43%** | **BEST** |
| 4 | 0.0708 | 97.33% | 0.1883 | 93.12% | — |
| 5 | 0.0571 | 97.80% | 0.1271 | 95.03% | — |
| 6 | 0.0512 | 97.80% | 0.1460 | 94.65% | — |
| 7 | 0.0596 | 97.64% | 0.1246 | 95.16% | LR → 5e-5 |
| 8 | 0.0458 | 98.19% | 0.1394 | 95.41% | EARLY STOP |

After epoch 3, training loss keeps dropping while val loss rises — classic overfitting signal. Early stopping halted training before it could worsen. Best checkpoint saved to `checkpoints/best_model.pth`.

See `training_curves.png` for loss and accuracy plots.

---

## Gatekeeper Classifier

> Trained by `gatekeeper_train.py`. Evaluated by `gatekeeper_eval.py`.
> Data prepared by `gatekeeper_data.py`.

### What it does

The gatekeeper is a lightweight binary classifier that runs **before** the pneumonia model on every prediction. Its job is to answer one question: *"Is this a frontal chest X-ray?"*

- **PASS** → image is a frontal chest X-ray → proceed to pneumonia screening
- **REJECT** → image is not a frontal chest X-ray → abort, return rejection message

This prevents the pneumonia model from being forced to output NORMAL or PNEUMONIA on an unrelated image (e.g., a bone X-ray, a photo, or a non-medical image), which would produce meaningless and potentially misleading results.

### What it was trained on

| Class | Source |
|-------|--------|
| `chest_xray` | Frontal chest X-rays from the Kaggle pneumonia dataset |
| `not_chest_xray` | Bone fracture X-ray images (non-chest body parts) |

### Architecture

MobileNetV3-Small — chosen for its lightweight footprint (fast gatekeeper check before the heavier EfficientNet-B0 runs).

```
Linear(576, 256) → Hardswish → Dropout(0.2) → Linear(256, 2)
```

### Integration

The gatekeeper runs automatically, first, inside `predict.py`. You do not need to call it separately — it is invisible to the user unless an image is rejected.

---

## Confidence Threshold

### Default threshold: **70%**

After the pneumonia classifier produces a prediction, the confidence score is checked before any result is shown:

| Confidence | Outcome |
|-----------|---------|
| **< 70%** | `[?] UNCERTAIN` — model is not confident enough; recommend professional review |
| **≥ 70%, PNEUMONIA** | `[!] Screening result: SIGNS CONSISTENT WITH PNEUMONIA` |
| **≥ 70%, NORMAL** | `[OK] Screening result: NO PNEUMONIA INDICATORS DETECTED` |

This is a **default safety behavior**, not an optional setting. A 51% confidence PNEUMONIA prediction is not treated the same as a 99% one — the UNCERTAIN path exists specifically to surface ambiguous cases rather than forcing a label.

Both confident outcomes include the caveat: *"This is an AI-assisted screening result, not a diagnosis."*

---

## Test Set Evaluation

> Evaluated by `evaluate.py` on 624 held-out test images (never seen during training or validation).

### Overall Metrics

| Metric | Value |
|--------|------:|
| **Test Accuracy** | **89.10%** |
| Precision (Pneumonia) | 86.59% |
| Recall (Pneumonia) | 97.69% |
| **F1 Score (Pneumonia)** | **91.81%** |

### Screening-Relevant Metrics

| Metric | Value | Meaning |
|--------|------:|---------|
| **Sensitivity** | **97.69%** | Flags 97.7% of pneumonia cases for follow-up |
| Specificity | 74.79% | Correctly clears 74.8% of normal cases |
| PPV | 86.59% | 86.6% of positive flags are true positives |
| **NPV** | **95.11%** | 95.1% of clear results are truly normal |
| False Negative Rate | 2.31% | Misses 2.3% of pneumonia cases (9 out of 390) |
| False Positive Rate | 25.21% | 25.2% of normals flagged for follow-up |

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

> **Key insight:** The model has very high sensitivity (97.69%) — it almost never misses a pneumonia case (only 9 out of 390). The trade-off is a higher false positive rate (59 normals flagged for follow-up). For a screening tool, this is an acceptable trade-off: missing a sick patient is far worse than an extra referral. The high NPV (95.11%) means a NORMAL screening result carries strong negative predictive value.

Results saved in `results/`: `test_metrics.json`, `test_report.txt`, `confusion_matrix.png`.

---

## Grad-CAM Visualizations

> Generated by `gradcam.py`.

Grad-CAM (Gradient-weighted Class Activation Mapping) overlays a heatmap on the original X-ray showing which regions the model attended to when making its prediction.

**Qualitative findings from the visualization grid:**

- **PNEUMONIA cases:** The model consistently attends to the **lung fields** — particularly regions showing opacity or haziness. Heatmap activation concentrates over consolidation areas, which aligns with what a radiologist would examine.
- **NORMAL cases:** Activation tends toward the **central chest region** and lung borders, with more diffuse attention patterns consistent with the absence of focal pathology.
- **Misclassified cases (2 in the grid):** Grad-CAM revealed that on false positives, the model sometimes attends to rib shadows or cardiac silhouette artifacts rather than true lung pathology — useful signal for understanding failure modes.

See `results/gradcam_grid.png` for the full visualization grid.

---

## Single Image Prediction

> Use `predict.py` for combined gatekeeper + pneumonia screening on any chest X-ray.

```bash
C:\anaconda\python.exe predict.py <path_to_xray_image>
```

### Example outputs

**Normal chest X-ray (confident):**
```
  [Gatekeeper Check]
  Result:     PASSED (Chest X-ray confirmed)
  Confidence: 100.0%

  [Pneumonia Prediction]
  Probabilities:
    NORMAL:     79.9%  <<
    PNEUMONIA:  20.1%

  [OK] Screening result: NO PNEUMONIA INDICATORS DETECTED (confidence 79.9%)
      This is an AI-assisted screening result, not a diagnosis.
```

**Pneumonia case (confident):**
```
  [Gatekeeper Check]
  Result:     PASSED (Chest X-ray confirmed)
  Confidence: 100.0%

  [Pneumonia Prediction]
  Probabilities:
    NORMAL:     0.0%
    PNEUMONIA:  100.0%  <<

  [!] Screening result: SIGNS CONSISTENT WITH PNEUMONIA (confidence 100.0%)
      This is an AI-assisted screening result, not a diagnosis -- recommend clinical follow-up.
```

**Ambiguous image (below confidence threshold):**
```
  [Pneumonia Prediction]
  Probabilities:
    NORMAL:     55.0%  <<
    PNEUMONIA:  45.0%

  [?] UNCERTAIN -- Confidence (55.0%) below threshold (70%).
      Recommend professional review rather than relying on this prediction.
```

**Non-chest-X-ray input (rejected by gatekeeper):**
```
  [Gatekeeper Check]
  Result:     REJECTED (Not a chest X-ray)
  Confidence: 98.3%

  [X] This image does not appear to be a frontal chest X-ray.
      Pneumonia prediction is aborted to prevent false results.
```

---

## How to Run (All Scripts)

Run all scripts from `D:\DiagnoVision\` using Anaconda base Python.

```bash
# Step 1 — Verify environment and CUDA availability
C:\anaconda\python.exe verify_env.py

# Step 2 — Audit dataset: counts, class balance, corruption check
C:\anaconda\python.exe data_audit.py

# Step 3 — Re-split train/val from original data (creates chest_xray_split/)
C:\anaconda\python.exe resplit_data.py

# Step 4 — Test data pipeline: loaders, transforms, GPU transfer
C:\anaconda\python.exe data_pipeline.py

# Step 5 — Model setup: architecture, freeze strategy, VRAM check
C:\anaconda\python.exe model_setup.py

# Step 6 — Train the pneumonia classifier (EfficientNet-B0, early stopping)
C:\anaconda\python.exe train.py

# Step 7 — Evaluate on held-out test set; saves metrics to results/
C:\anaconda\python.exe evaluate.py

# Step 8 — Generate Grad-CAM visualizations; saves grid to results/
C:\anaconda\python.exe gradcam.py

# Step 9a — Prepare gatekeeper training data (chest vs. non-chest split)
C:\anaconda\python.exe gatekeeper_data.py

# Step 9b — Train the gatekeeper classifier (MobileNetV3-Small)
C:\anaconda\python.exe gatekeeper_train.py

# Step 9c — Evaluate gatekeeper on held-out set
C:\anaconda\python.exe gatekeeper_eval.py

# Inference — Run gatekeeper + pneumonia screening on a single image
C:\anaconda\python.exe predict.py "D:\DiagnoVision\chest_xray_split\test\NORMAL\IM-0001-0001.jpeg"
C:\anaconda\python.exe predict.py "D:\DiagnoVision\chest_xray_split\test\PNEUMONIA\person1_virus_6.jpeg"
```

---

## Project Structure

```
DiagnoVision/
├── chest_xray/              # Original dataset (untouched)
│   ├── train/ ├── val/ └── test/
├── chest_xray_split/        # Re-split dataset (used for training)
│   ├── train/               # 4,447 images (85%)
│   ├── val/                 # 785 images (15%)
│   └── test/                # 624 images (held-out)
├── gatekeeper_split/        # Gatekeeper training data
│   ├── train/ ├── val/ └── test/
├── bone_fracture_data/      # Non-chest X-ray source for gatekeeper
├── checkpoints/
│   ├── best_model.pth       # Pneumonia model — best val loss (epoch 3)
│   ├── last_model.pth       # Pneumonia model — final epoch
│   └── gatekeeper_best.pth  # Gatekeeper model — best val loss
├── results/
│   ├── test_metrics.json    # Structured evaluation metrics
│   ├── test_report.txt      # Human-readable evaluation report
│   ├── confusion_matrix.png # Confusion matrix heatmap
│   └── gradcam_grid.png     # Grad-CAM visualization grid
├── verify_env.py            # Step 1: Environment & CUDA check
├── data_audit.py            # Step 2: Dataset audit & corruption check
├── resplit_data.py          # Step 3: Stratified 85/15 re-split
├── data_pipeline.py         # Step 4: DataLoaders, transforms, augmentation
├── model_setup.py           # Step 5: EfficientNet-B0 architecture & VRAM check
├── train.py                 # Step 6: Training loop with early stopping
├── evaluate.py              # Step 7: Test set evaluation & metrics
├── gradcam.py               # Step 8: Grad-CAM visualization grid
├── gatekeeper_data.py       # Step 9a: Gatekeeper data preparation
├── gatekeeper_train.py      # Step 9b: Gatekeeper MobileNetV3 training
├── gatekeeper_eval.py       # Step 9c: Gatekeeper evaluation
├── predict.py               # Inference: gatekeeper → pneumonia → confidence
├── sample_grid.png          # Sample X-ray grid from data audit
├── training_curves.png      # Loss & accuracy training plots
└── README.md                # This file
```

---

## Known Limitations

| Limitation | Detail |
|------------|--------|
| **Single-hospital source** | All images from Guangzhou Women and Children's Medical Center — may not generalise to other hospitals, equipment, or protocols |
| **Pediatric only** | Dataset ages 1–5; not validated on adult chest X-rays |
| **Frontal view only** | Not validated on lateral-view chest X-rays |
| **Binary classification** | Screens for pneumonia vs. normal only — does not screen for other pulmonary conditions (effusion, pneumothorax, mass, etc.) |
| **No clinical validation** | Not evaluated in a clinical setting or against radiologist ground truth beyond the Kaggle dataset labels |
| **Label quality** | Dataset labels are from the original Kaggle release; expert-confirmed but not independently re-verified for this project |
| **Confidence threshold is heuristic** | The 70% threshold was set as a reasonable default — not optimised against a clinical outcome metric |
| **Gatekeeper scope** | Trained on chest X-rays vs. bone fracture X-rays; may not correctly reject other unexpected input types (CT scans, ultrasound, photos) |

> **This tool is a screening aid, not a diagnostic system. It is not validated for clinical use and must not replace professional medical judgement.**

---

> **Status**: Pipeline complete. Pneumonia model trained to **96.43% val accuracy**, evaluated at **89.10% test accuracy** with **97.69% sensitivity** on 624 held-out images. Gatekeeper classifier rejects non-chest X-rays at the input stage. Confidence-based abstention prevents low-confidence predictions from being surfaced as definitive results.

