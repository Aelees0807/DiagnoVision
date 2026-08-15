"""
DiagnoVision -- Step 9: Gatekeeper Evaluation
Evaluates the gatekeeper checkpoint on the validation set and any
additional test images. Reports accuracy, precision, recall, F1,
confusion matrix, and saves results.
"""

import json
import datetime
from pathlib import Path
from collections import Counter

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

# ── Configuration ──────────────────────────────────────────────
DATA_ROOT       = Path(r"D:\DiagnoVision\gatekeeper_split")
CHECKPOINT_PATH = Path(r"D:\DiagnoVision\checkpoints\gatekeeper_best.pth")
RESULTS_DIR     = Path(r"D:\DiagnoVision\results")
IMAGE_SIZE  = 224
BATCH_SIZE  = 32
NUM_WORKERS = 0

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]
CLASS_NAMES   = ["chest_xray", "not_chest_xray"]


def build_model(device, checkpoint_path):
    """Build MobileNetV3-Small and load gatekeeper checkpoint."""
    model = models.mobilenet_v3_small(weights=None)

    in_features = model.classifier[0].in_features  # 576
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 256),
        nn.Hardswish(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(256, 2)
    )

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()

    return model, checkpoint


def predict_single_image(model, image_path, transform, device):
    """Predict a single image and return class name + confidence."""
    img = Image.open(image_path).convert("RGB")
    img_tensor = transform(img).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(img_tensor)
        probs = torch.softmax(output, dim=1)
        pred_idx = output.argmax(dim=1).item()
        confidence = probs[0, pred_idx].item()

    return CLASS_NAMES[pred_idx], confidence, probs[0].cpu().numpy()


def main():
    print("=" * 70)
    print("  DiagnoVision -- Step 9: Gatekeeper Evaluation")
    print("=" * 70)
    print()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1. Load model ─────────────────────────────────────────
    print()
    print("  1. LOADING GATEKEEPER MODEL")
    print("  " + "-" * 60)

    model, checkpoint = build_model(device, CHECKPOINT_PATH)
    print(f"  Checkpoint:  {CHECKPOINT_PATH}")
    print(f"  Model:       MobileNetV3-Small")
    print(f"  Best epoch:  {checkpoint.get('epoch', 'N/A')}")
    print(f"  Val acc:     {checkpoint.get('val_acc', 'N/A'):.2f}%")
    print()

    # ── 2. Evaluate on validation set ─────────────────────────
    print("  2. EVALUATING ON VALIDATION SET")
    print("  " + "-" * 60)

    val_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    val_dataset = datasets.ImageFolder(DATA_ROOT / "val", transform=val_transform)
    val_loader = DataLoader(
        val_dataset, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=True
    )

    print(f"  Val images: {len(val_dataset)}")
    print(f"  Class mapping: {val_dataset.class_to_idx}")
    label_counts = Counter([l for _, l in val_dataset.samples])
    for cls_name, cls_idx in val_dataset.class_to_idx.items():
        print(f"    {cls_name}: {label_counts[cls_idx]}")
    print()

    all_preds = []
    all_labels = []

    with torch.no_grad():
        for images, labels in val_loader:
            images = images.to(device)
            outputs = model(images)
            _, predicted = outputs.max(1)
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.numpy())

    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)

    # Metrics
    acc = accuracy_score(all_labels, all_preds)
    precision_per = precision_score(all_labels, all_preds, average=None)
    recall_per = recall_score(all_labels, all_preds, average=None)
    f1_per = f1_score(all_labels, all_preds, average=None)
    cm = confusion_matrix(all_labels, all_preds)

    print(f"  Overall Accuracy:     {acc * 100:.2f}%")
    print()
    print("  Per-Class Metrics:")
    for i, name in enumerate(CLASS_NAMES):
        print(f"    {name}:")
        print(f"      Precision: {precision_per[i]*100:.2f}%")
        print(f"      Recall:    {recall_per[i]*100:.2f}%")
        print(f"      F1:        {f1_per[i]*100:.2f}%")
    print()

    print("  Confusion Matrix:")
    print(f"                         Predicted")
    print(f"                         chest_xray  not_chest_xray")
    print(f"  Actual chest_xray      {cm[0][0]:>8}    {cm[0][1]:>8}")
    print(f"  Actual not_chest_xray  {cm[1][0]:>8}    {cm[1][1]:>8}")
    print()

    report = classification_report(all_labels, all_preds, target_names=CLASS_NAMES, digits=4)
    print("  Classification Report:")
    print("  " + "-" * 60)
    for line in report.split('\n'):
        print(f"  {line}")
    print()

    # ── 3. Confusion matrix plot ──────────────────────────────
    print("  3. SAVING RESULTS")
    print("  " + "-" * 60)

    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(cm, interpolation='nearest', cmap='Greens')
    ax.figure.colorbar(im, ax=ax)

    ax.set(
        xticks=[0, 1], yticks=[0, 1],
        xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES,
        xlabel='Predicted Label', ylabel='True Label',
        title=f'Gatekeeper -- Confusion Matrix\nAccuracy: {acc*100:.2f}%'
    )

    thresh = cm.max() / 2.0
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f'{cm[i,j]}\n({cm[i,j]/cm.sum()*100:.1f}%)',
                    ha="center", va="center", fontsize=14, fontweight="bold",
                    color="white" if cm[i,j] > thresh else "black")

    plt.tight_layout()
    cm_path = RESULTS_DIR / "gatekeeper_confusion_matrix.png"
    plt.savefig(cm_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  Confusion matrix: {cm_path}")

    # Save metrics
    metrics = {
        "evaluation_timestamp": datetime.datetime.now().isoformat(),
        "model": "MobileNetV3-Small",
        "task": "gatekeeper_ood_check",
        "val_set_size": len(val_dataset),
        "accuracy": round(acc * 100, 2),
        "per_class": {
            CLASS_NAMES[i]: {
                "precision": round(precision_per[i] * 100, 2),
                "recall": round(recall_per[i] * 100, 2),
                "f1": round(f1_per[i] * 100, 2),
                "support": int(label_counts.get(i, 0))
            }
            for i in range(2)
        },
        "confusion_matrix": {
            "chest_pred_chest": int(cm[0][0]),
            "chest_pred_not": int(cm[0][1]),
            "not_pred_chest": int(cm[1][0]),
            "not_pred_not": int(cm[1][1])
        },
        "checkpoint": {
            "path": str(CHECKPOINT_PATH),
            "best_epoch": checkpoint.get('epoch', 'N/A'),
            "val_loss": round(checkpoint.get('val_loss', 0), 4),
            "val_acc": round(checkpoint.get('val_acc', 0), 2)
        }
    }

    metrics_path = RESULTS_DIR / "gatekeeper_metrics.json"
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"  Metrics JSON: {metrics_path}")
    print()

    # ── 4. Test on specific images ────────────────────────────
    print("  4. TESTING ON SPECIFIC IMAGES")
    print("  " + "-" * 60)

    test_images = []

    # Test on original chest X-rays (should be "chest_xray")
    chest_test_dir = Path(r"D:\DiagnoVision\chest_xray\test")
    if chest_test_dir.exists():
        for cls in ["NORMAL", "PNEUMONIA"]:
            cls_dir = chest_test_dir / cls
            if cls_dir.exists():
                imgs = sorted([f for f in cls_dir.iterdir() if f.is_file()])[:2]
                for img in imgs:
                    test_images.append((img, "chest_xray (expected)"))

    # Test on bone fracture images (should be "not_chest_xray")
    bone_test_dir = Path(r"D:\DiagnoVision\bone_fracture_data\BoneFractureYolo8\test\images")
    if bone_test_dir.exists():
        imgs = sorted([f for f in bone_test_dir.iterdir() if f.is_file()])[:4]
        for img in imgs:
            test_images.append((img, "not_chest_xray (expected)"))

    # Test on handLong.jpeg if it exists (the image that caused the error before)
    hand_img = Path(r"C:\Users\Aelees Bhuva\Downloads\handLong.jpeg")
    if hand_img.exists():
        test_images.append((hand_img, "not_chest_xray (expected)"))

    if test_images:
        for img_path, expected in test_images:
            pred_name, conf, _ = predict_single_image(model, img_path, val_transform, device)
            correct = "[OK]" if expected.startswith(pred_name) else "[X]"
            print(f"  {correct} {Path(img_path).name:<40} -> {pred_name:<16} "
                  f"({conf*100:.1f}%)  [{expected}]")
    else:
        print("  No additional test images found.")

    print()
    print("=" * 70)
    print("  GATEKEEPER EVALUATION COMPLETE")
    print(f"  Accuracy: {acc * 100:.2f}%")
    print("=" * 70)


if __name__ == "__main__":
    main()
