"""
DiagnoVision -- Step 6: Training Loop
Full training pipeline with weighted CE loss, Adam optimizer,
LR scheduler, best checkpoint saving, and early stopping.
"""

import os
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
DATA_ROOT = Path(r"D:\DiagnoVision\chest_xray_split")
CHECKPOINT_DIR = Path(r"D:\DiagnoVision\checkpoints")
IMAGE_SIZE = 224
BATCH_SIZE = 32
NUM_WORKERS = 0           # Windows compatibility
RANDOM_SEED = 42

# Training hyperparameters
LEARNING_RATE = 1e-4
WEIGHT_DECAY = 1e-4       # L2 regularization
NUM_EPOCHS = 20           # Full training run
EARLY_STOP_PATIENCE = 5   # Stop if val loss doesn't improve for N epochs

# ImageNet normalization
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# Reproducibility
torch.manual_seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
if torch.cuda.is_available():
    torch.cuda.manual_seed(RANDOM_SEED)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def build_dataloaders():
    """Build train/val/test DataLoaders with augmentation and normalization."""

    train_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomRotation(degrees=10),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomResizedCrop(
            size=IMAGE_SIZE, scale=(0.85, 1.0), ratio=(0.9, 1.1)
        ),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    eval_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    train_dataset = datasets.ImageFolder(DATA_ROOT / "train", transform=train_transform)
    val_dataset = datasets.ImageFolder(DATA_ROOT / "val", transform=eval_transform)
    test_dataset = datasets.ImageFolder(DATA_ROOT / "test", transform=eval_transform)

    train_loader = DataLoader(
        train_dataset, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=NUM_WORKERS, pin_memory=True, drop_last=True
    )
    val_loader = DataLoader(
        val_dataset, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=True
    )
    test_loader = DataLoader(
        test_dataset, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=True
    )

    return train_loader, val_loader, test_loader, train_dataset


def build_model(device):
    """Build EfficientNet-B0 with frozen early layers and custom classifier."""

    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)

    # Freeze features[0-5]
    for param in model.features.parameters():
        param.requires_grad = False
    for block_idx in [6, 7, 8]:
        for param in model.features[block_idx].parameters():
            param.requires_grad = True

    # Replace classifier head
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(512, 2)
    )

    return model.to(device)


def compute_class_weights(train_dataset, device):
    """Compute inverse-frequency class weights for imbalanced data."""
    train_labels = [label for _, label in train_dataset.samples]
    label_counts = Counter(train_labels)
    num_classes = len(label_counts)
    total = len(train_labels)

    weights = []
    for cls_idx in range(num_classes):
        w = total / (num_classes * label_counts[cls_idx])
        weights.append(w)

    return torch.FloatTensor(weights).to(device)


def train_one_epoch(model, loader, criterion, optimizer, device):
    """Train for one epoch. Returns average loss and accuracy."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for batch_idx, (images, labels) in enumerate(loader):
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

    epoch_loss = running_loss / total
    epoch_acc = correct / total * 100
    return epoch_loss, epoch_acc


def validate(model, loader, criterion, device):
    """Validate model. Returns average loss and accuracy."""
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

    epoch_loss = running_loss / total
    epoch_acc = correct / total * 100
    return epoch_loss, epoch_acc


def main():
    print("=" * 70)
    print("  DiagnoVision -- Step 6: Training Loop")
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

    train_loader, val_loader, test_loader, train_dataset = build_dataloaders()
    print(f"  Train batches: {len(train_loader)}")
    print(f"  Val batches:   {len(val_loader)}")

    model = build_model(device)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Model: EfficientNet-B0 (trainable params: {trainable:,})")

    class_weights = compute_class_weights(train_dataset, device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    print(f"  Loss: CrossEntropyLoss (weights: NORMAL={class_weights[0]:.4f}, "
          f"PNEUMONIA={class_weights[1]:.4f})")

    optimizer = optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY
    )
    print(f"  Optimizer: Adam (lr={LEARNING_RATE}, weight_decay={WEIGHT_DECAY})")

    # ReduceLROnPlateau: reduce LR by 0.5 if val loss plateaus for 3 epochs
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3, verbose=False
    )
    print(f"  Scheduler: ReduceLROnPlateau (factor=0.5, patience=3)")
    print(f"  Early stopping: patience={EARLY_STOP_PATIENCE}")
    print(f"  Epochs: {NUM_EPOCHS}")
    print()

    # Create checkpoint directory
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    # ── 2. Training Loop ───────────────────────────────────────
    print("  2. TRAINING")
    print("  " + "-" * 60)
    print()

    # Header
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

        # Train
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)

        # Validate
        val_loss, val_acc = validate(model, val_loader, criterion, device)

        # Step scheduler
        scheduler.step(val_loss)
        current_lr = optimizer.param_groups[0]['lr']

        # Record history
        history['train_loss'].append(train_loss)
        history['train_acc'].append(train_acc)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(val_acc)
        history['lr'].append(current_lr)

        elapsed = time.time() - epoch_start
        status = ""

        # Check for improvement
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            best_epoch = epoch
            epochs_no_improve = 0
            status = "<-- BEST (saved)"

            # Save best checkpoint
            checkpoint = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'scheduler_state_dict': scheduler.state_dict(),
                'val_loss': val_loss,
                'val_acc': val_acc,
                'train_loss': train_loss,
                'train_acc': train_acc,
                'class_to_idx': train_dataset.class_to_idx,
                'history': history,
            }
            torch.save(checkpoint, CHECKPOINT_DIR / "best_model.pth")
        else:
            epochs_no_improve += 1

        print(f"  {epoch:>5} | {train_loss:>10.4f} {train_acc:>9.2f}% | "
              f"{val_loss:>10.4f} {val_acc:>9.2f}% | {current_lr:>10.6f} {elapsed:>5.1f}s {status}")

        # Early stopping check
        if epochs_no_improve >= EARLY_STOP_PATIENCE:
            print(f"\n  [EARLY STOP] No improvement for {EARLY_STOP_PATIENCE} epochs. Stopping.")
            break

    print()

    # ── 3. Save final checkpoint ───────────────────────────────
    final_checkpoint = {
        'epoch': epoch,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'scheduler_state_dict': scheduler.state_dict(),
        'val_loss': val_loss,
        'val_acc': val_acc,
        'history': history,
    }
    torch.save(final_checkpoint, CHECKPOINT_DIR / "last_model.pth")

    # ── 4. Summary ─────────────────────────────────────────────
    print("  3. TRAINING SUMMARY")
    print("  " + "-" * 60)
    print(f"  Total epochs run:   {epoch}")
    print(f"  Best epoch:         {best_epoch}")
    print(f"  Best val loss:      {best_val_loss:.4f}")
    print(f"  Best val accuracy:  {best_val_acc:.2f}%")
    print(f"  Final train loss:   {history['train_loss'][-1]:.4f}")
    print(f"  Final train acc:    {history['train_acc'][-1]:.2f}%")
    print()
    print(f"  Checkpoints saved:")
    print(f"    Best:  {CHECKPOINT_DIR / 'best_model.pth'}")
    print(f"    Last:  {CHECKPOINT_DIR / 'last_model.pth'}")
    print()

    # VRAM usage
    if device.type == "cuda":
        peak_vram = torch.cuda.max_memory_allocated() / (1024 ** 2)
        total_vram = torch.cuda.get_device_properties(0).total_memory / (1024 ** 2)
        print(f"  Peak VRAM:     {peak_vram:.0f} MB / {total_vram:.0f} MB ({peak_vram/total_vram*100:.1f}%)")

    print()
    print("=" * 70)
    print("  TRAINING COMPLETE")
    print("  Change NUM_EPOCHS or hyperparameters as needed.")
    print("=" * 70)

    # ── 4. Plot Training Curves ────────────────────────────────
    plot_path = Path(r"D:\DiagnoVision\training_curves.png")
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("DiagnoVision -- Training Curves", fontsize=15, fontweight="bold")

    epochs_range = range(1, len(history['train_loss']) + 1)

    # Loss curve
    ax1.plot(epochs_range, history['train_loss'], 'b-o', markersize=4, label='Train Loss')
    ax1.plot(epochs_range, history['val_loss'], 'r-o', markersize=4, label='Val Loss')
    ax1.axvline(x=best_epoch, color='green', linestyle='--', alpha=0.6, label=f'Best epoch ({best_epoch})')
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Loss')
    ax1.set_title('Loss Curve')
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Accuracy curve
    ax2.plot(epochs_range, history['train_acc'], 'b-o', markersize=4, label='Train Acc')
    ax2.plot(epochs_range, history['val_acc'], 'r-o', markersize=4, label='Val Acc')
    ax2.axvline(x=best_epoch, color='green', linestyle='--', alpha=0.6, label=f'Best epoch ({best_epoch})')
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Accuracy (%)')
    ax2.set_title('Accuracy Curve')
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(plot_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"\n  Training curves saved to: {plot_path}")


if __name__ == "__main__":
    main()
