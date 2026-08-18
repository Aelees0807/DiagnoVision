"""
DiagnoVision -- Step 9: Gatekeeper Training
Trains a lightweight MobileNetV3-Small to distinguish
"chest X-ray" from "not chest X-ray" images.
Saves best checkpoint to checkpoints/gatekeeper_best.pth.
"""

import time
from pathlib import Path
from collections import Counter

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ── Configuration ──────────────────────────────────────────────
DATA_ROOT      = Path(r"D:\DiagnoVision\gatekeeper_split")
CHECKPOINT_DIR = Path(r"D:\DiagnoVision\checkpoints")
IMAGE_SIZE     = 224
BATCH_SIZE     = 32
NUM_WORKERS    = 0
RANDOM_SEED    = 42

# Training hyperparameters
LEARNING_RATE       = 1e-3
WEIGHT_DECAY        = 1e-4
NUM_EPOCHS          = 15
EARLY_STOP_PATIENCE = 4

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

# Reproducibility
torch.manual_seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed(RANDOM_SEED)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def build_dataloaders():
    """Build train/val DataLoaders with augmentation."""
    train_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomRotation(degrees=10),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    val_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    train_dataset = datasets.ImageFolder(DATA_ROOT / "train", transform=train_transform)
    val_dataset   = datasets.ImageFolder(DATA_ROOT / "val", transform=val_transform)

    train_loader = DataLoader(
        train_dataset, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=NUM_WORKERS, pin_memory=True, drop_last=True
    )
    val_loader = DataLoader(
        val_dataset, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=True
    )

    return train_loader, val_loader, train_dataset, val_dataset


def build_model(device):
    """Build MobileNetV3-Small with frozen backbone + custom binary head."""
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.IMAGENET1K_V1)

    # Freeze all feature layers
    for param in model.features.parameters():
        param.requires_grad = False

    # Replace classifier head (original: Linear(576, 1000))
    # MobileNetV3-Small classifier structure:
    #   0: Linear(576, 1024)
    #   1: Hardswish
    #   2: Dropout(0.2)
    #   3: Linear(1024, 1000)
    in_features = model.classifier[0].in_features  # 576
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 256),
        nn.Hardswish(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(256, 2)  # chest_xray=0, not_chest_xray=1
    )

    return model.to(device)


def train_one_epoch(model, loader, criterion, optimizer, device):
    """Train for one epoch."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()

    return running_loss / total, correct / total * 100


def validate(model, loader, criterion, device):
    """Validate model."""
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)

            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()

    return running_loss / total, correct / total * 100


def main():
    print("=" * 70)
    print("  DiagnoVision -- Step 9: Gatekeeper Training")
    print("  (MobileNetV3-Small: chest_xray vs not_chest_xray)")
    print("=" * 70)
    print()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")
    if device.type == "cuda":
        print(f"  GPU:    {torch.cuda.get_device_name(0)}")
    print()

    # ── 1. Build components ────────────────────────────────────
    print("  1. BUILDING COMPONENTS")
    print("  " + "-" * 60)

    train_loader, val_loader, train_dataset, val_dataset = build_dataloaders()

    print(f"  Train images: {len(train_dataset)}")
    print(f"  Val images:   {len(val_dataset)}")
    print(f"  Class mapping: {train_dataset.class_to_idx}")

    # Class distribution
    train_labels = [l for _, l in train_dataset.samples]
    label_counts = Counter(train_labels)
    for cls_name, cls_idx in train_dataset.class_to_idx.items():
        print(f"    {cls_name}: {label_counts[cls_idx]}")

    model = build_model(device)
    total_params = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Model: MobileNetV3-Small")
    print(f"  Total params:     {total_params:,}")
    print(f"  Trainable params: {trainable:,}")

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY
    )
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=2, verbose=False
    )

    print(f"  Loss:      CrossEntropyLoss")
    print(f"  Optimizer: Adam (lr={LEARNING_RATE}, wd={WEIGHT_DECAY})")
    print(f"  Scheduler: ReduceLROnPlateau (factor=0.5, patience=2)")
    print(f"  Early stopping: patience={EARLY_STOP_PATIENCE}")
    print(f"  Epochs: {NUM_EPOCHS}")
    print()

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    # ── 2. Training Loop ───────────────────────────────────────
    print("  2. TRAINING")
    print("  " + "-" * 60)
    print()

    print(f"  {'Epoch':>5} | {'Train Loss':>10} {'Train Acc':>10} | "
          f"{'Val Loss':>10} {'Val Acc':>10} | {'LR':>10} {'Time':>6} {'Status'}")
    print("  " + "-" * 85)

    best_val_loss = float('inf')
    best_val_acc = 0.0
    best_epoch = 0
    epochs_no_improve = 0
    history = {'train_loss': [], 'train_acc': [], 'val_loss': [], 'val_acc': [], 'lr': []}

    for epoch in range(1, NUM_EPOCHS + 1):
        epoch_start = time.time()

        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = validate(model, val_loader, criterion, device)

        scheduler.step(val_loss)
        current_lr = optimizer.param_groups[0]['lr']

        history['train_loss'].append(train_loss)
        history['train_acc'].append(train_acc)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(val_acc)
        history['lr'].append(current_lr)

        elapsed = time.time() - epoch_start
        status = ""

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            best_epoch = epoch
            epochs_no_improve = 0
            status = "<-- BEST (saved)"

            checkpoint = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_loss': val_loss,
                'val_acc': val_acc,
                'train_loss': train_loss,
                'train_acc': train_acc,
                'class_to_idx': train_dataset.class_to_idx,
                'history': history,
                'model_type': 'mobilenet_v3_small',
                'task': 'gatekeeper_ood_check',
            }
            torch.save(checkpoint, CHECKPOINT_DIR / "gatekeeper_best.pth")
        else:
            epochs_no_improve += 1

        print(f"  {epoch:>5} | {train_loss:>10.4f} {train_acc:>9.2f}% | "
              f"{val_loss:>10.4f} {val_acc:>9.2f}% | {current_lr:>10.6f} {elapsed:>5.1f}s {status}")

        if epochs_no_improve >= EARLY_STOP_PATIENCE:
            print(f"\n  [EARLY STOP] No improvement for {EARLY_STOP_PATIENCE} epochs.")
            break

    print()

    # ── 3. Training curves ────────────────────────────────────
    plot_path = Path(r"D:\DiagnoVision\results\gatekeeper_training_curves.png")
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("DiagnoVision -- Gatekeeper Training Curves", fontsize=15, fontweight="bold")

    epochs_range = range(1, len(history['train_loss']) + 1)

    ax1.plot(epochs_range, history['train_loss'], 'b-o', markersize=4, label='Train Loss')
    ax1.plot(epochs_range, history['val_loss'], 'r-o', markersize=4, label='Val Loss')
    ax1.axvline(x=best_epoch, color='green', linestyle='--', alpha=0.6, label=f'Best ({best_epoch})')
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Loss')
    ax1.set_title('Loss Curve')
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(epochs_range, history['train_acc'], 'b-o', markersize=4, label='Train Acc')
    ax2.plot(epochs_range, history['val_acc'], 'r-o', markersize=4, label='Val Acc')
    ax2.axvline(x=best_epoch, color='green', linestyle='--', alpha=0.6, label=f'Best ({best_epoch})')
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Accuracy (%)')
    ax2.set_title('Accuracy Curve')
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(plot_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()

    # ── Summary ────────────────────────────────────────────────
    print("  3. TRAINING SUMMARY")
    print("  " + "-" * 60)
    print(f"  Total epochs:       {epoch}")
    print(f"  Best epoch:         {best_epoch}")
    print(f"  Best val loss:      {best_val_loss:.4f}")
    print(f"  Best val accuracy:  {best_val_acc:.2f}%")
    print(f"  Training curves:    {plot_path}")
    print(f"  Checkpoint:         {CHECKPOINT_DIR / 'gatekeeper_best.pth'}")
    print()
    print("=" * 70)
    print("  GATEKEEPER TRAINING COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
