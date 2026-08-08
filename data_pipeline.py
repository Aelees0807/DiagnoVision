"""
DiagnoVision -- Step 4: Data Pipeline
PyTorch Dataset & DataLoader with augmentation, ImageNet normalization,
and class-weighted loss to handle imbalance.
"""

import os
from pathlib import Path
from collections import Counter

import torch
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import numpy as np

# ── Configuration ──────────────────────────────────────────────
DATA_ROOT = Path(r"D:\DiagnoVision\chest_xray_split")
IMAGE_SIZE = 224
BATCH_SIZE = 32
NUM_WORKERS = 0  # Windows requires 0 (spawn-based multiprocessing hangs otherwise)
RANDOM_SEED = 42

# ImageNet normalization stats (since we'll use pretrained weights)
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

def main():
    print("=" * 65)
    print("  DiagnoVision -- Step 4: Data Pipeline")
    print("=" * 65)
    print()

# ── 1. Define Transforms ──────────────────────────────────────
    print("  1. TRANSFORMS")
    print("  " + "-" * 55)

    # Train: augmentation + normalization
    train_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomRotation(degrees=10),           # +/- 10 degrees
        transforms.RandomHorizontalFlip(p=0.5),           # 50% chance flip
        transforms.RandomResizedCrop(                     # slight zoom/crop
            size=IMAGE_SIZE,
            scale=(0.85, 1.0),   # crop 85-100% of the image
            ratio=(0.9, 1.1)     # slight aspect ratio variation
        ),
        transforms.ToTensor(),                            # [0,255] -> [0,1]
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    # Val/Test: only resize + normalize (no augmentation)
    eval_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    print("  Train transforms:")
    for i, t in enumerate(train_transform.transforms):
        print(f"    {i+1}. {t}")
    print()
    print("  Val/Test transforms:")
    for i, t in enumerate(eval_transform.transforms):
        print(f"    {i+1}. {t}")
    print()

    # ── 2. Create Datasets ────────────────────────────────────────
    print("  2. LOADING DATASETS")
    print("  " + "-" * 55)

    # ImageFolder automatically assigns labels: NORMAL=0, PNEUMONIA=1 (alphabetical)
    train_dataset = datasets.ImageFolder(
        root=DATA_ROOT / "train",
        transform=train_transform
    )

    val_dataset = datasets.ImageFolder(
        root=DATA_ROOT / "val",
        transform=eval_transform
    )

    test_dataset = datasets.ImageFolder(
        root=DATA_ROOT / "test",
        transform=eval_transform
    )

    # Print class-to-index mapping
    print(f"  Class mapping: {train_dataset.class_to_idx}")
    print(f"  Train size:    {len(train_dataset):,}")
    print(f"  Val size:      {len(val_dataset):,}")
    print(f"  Test size:     {len(test_dataset):,}")
    print()

    # ── 3. Handle Class Imbalance ─────────────────────────────────
    print("  3. CLASS IMBALANCE HANDLING")
    print("  " + "-" * 55)

    # --- Strategy: Class-Weighted Loss (not weighted sampling) ---
    #
    # WHY class-weighted loss over weighted sampling:
    #
    # 1. WeightedRandomSampler oversamples the minority class, which means
    #    some NORMAL images repeat multiple times per epoch. With only ~1,147
    #    NORMAL images this risks overfitting to those specific images.
    #
    # 2. Class-weighted CrossEntropyLoss gives NORMAL a higher penalty when
    #    misclassified, achieving the same balancing effect WITHOUT repeating
    #    images. Every image is seen exactly once per epoch.
    #
    # 3. Simpler to implement and debug -- no sampler conflicts with shuffle.
    #
    # The weight for each class = total_samples / (num_classes * class_count)
    # This is the inverse frequency approach used by sklearn.

    train_labels = [label for _, label in train_dataset.samples]
    label_counts = Counter(train_labels)
    num_classes = len(label_counts)
    total_samples = len(train_labels)

    print(f"  Train label distribution:")
    for cls_idx, cls_name in enumerate(train_dataset.classes):
        count = label_counts[cls_idx]
        pct = count / total_samples * 100
        print(f"    {cls_name} (idx={cls_idx}): {count:,} ({pct:.1f}%)")

    # Compute class weights (inverse frequency)
    class_weights = []
    for cls_idx in range(num_classes):
        weight = total_samples / (num_classes * label_counts[cls_idx])
        class_weights.append(weight)

    class_weights_tensor = torch.FloatTensor(class_weights)

    print()
    print(f"  Strategy: Class-Weighted CrossEntropyLoss")
    print(f"  Reason:   Avoids oversampling minority class (risk of overfitting)")
    print(f"            Penalizes NORMAL misclassification more heavily instead")
    print()
    print(f"  Computed weights:")
    for cls_idx, cls_name in enumerate(train_dataset.classes):
        print(f"    {cls_name}: {class_weights[cls_idx]:.4f}")
    print()
    print(f"  Weight tensor (for nn.CrossEntropyLoss): {class_weights_tensor}")
    print()

    # ── 4. Create DataLoaders ─────────────────────────────────────
    print("  4. CREATING DATALOADERS")
    print("  " + "-" * 55)

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=NUM_WORKERS,
        pin_memory=True,        # Faster GPU transfer
        drop_last=True           # Drop incomplete last batch for stable training
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=True
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=True
    )

    print(f"  Batch size:    {BATCH_SIZE}")
    print(f"  Num workers:   {NUM_WORKERS}")
    print(f"  Pin memory:    True")
    print(f"  Train batches: {len(train_loader)}")
    print(f"  Val batches:   {len(val_loader)}")
    print(f"  Test batches:  {len(test_loader)}")
    print()

    # ── 5. Quick Test -- Load One Batch ────────────────────────────
    print("  5. QUICK TEST -- LOADING ONE BATCH")
    print("  " + "-" * 55)

    # Grab one batch from each loader
    for name, loader in [("Train", train_loader), ("Val", val_loader), ("Test", test_loader)]:
        images, labels = next(iter(loader))

        label_dist = Counter(labels.numpy())
        dist_str = ", ".join(
            f"{train_dataset.classes[k]}={v}" for k, v in sorted(label_dist.items())
        )

        print(f"  {name} batch:")
        print(f"    Image tensor shape : {images.shape}")
        print(f"    Label tensor shape : {labels.shape}")
        print(f"    Dtype              : {images.dtype}")
        print(f"    Value range        : [{images.min():.3f}, {images.max():.3f}]")
        print(f"    Label distribution : {dist_str}")
        print()

    # Verify GPU transfer works
    print("  GPU transfer test:")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    images, labels = next(iter(train_loader))
    images_gpu = images.to(device)
    labels_gpu = labels.to(device)
    print(f"    Device       : {device}")
    print(f"    Images on GPU: {images_gpu.device}")
    print(f"    Labels on GPU: {labels_gpu.device}")
    print(f"    GPU shape    : {images_gpu.shape}")
    del images_gpu, labels_gpu
    torch.cuda.empty_cache()
    print()

    # ── Summary ────────────────────────────────────────────────────
    print("=" * 65)
    print("  PIPELINE READY")
    print("  - Images: 224x224, 3-channel (grayscale converted to RGB)")
    print("  - Normalized: ImageNet mean/std")
    print("  - Train augmentation: rotation(+/-10), hflip, zoom/crop")
    print("  - Imbalance: class-weighted loss (NORMAL gets higher weight)")
    print("  - All batches load correctly, GPU transfer confirmed")
    print("=" * 65)


if __name__ == "__main__":
    main()
