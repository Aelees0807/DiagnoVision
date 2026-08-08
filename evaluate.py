"""
DiagnoVision -- Step 8: Evaluation
Evaluates the best checkpoint on the held-out test set.
Reports accuracy, precision, recall, F1, confusion matrix.
Saves all metrics to a results file and confusion matrix plot.
"""

import json
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

# ── Configuration ──────────────────────────────────────────────
DATA_ROOT = Path(r"D:\DiagnoVision\chest_xray_split")
CHECKPOINT_PATH = Path(r"D:\DiagnoVision\checkpoints\best_model.pth")
RESULTS_DIR = Path(r"D:\DiagnoVision\results")
IMAGE_SIZE = 224
BATCH_SIZE = 32
NUM_WORKERS = 0

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
CLASS_NAMES = ["NORMAL", "PNEUMONIA"]


def build_model(device, checkpoint_path):
    """Build EfficientNet-B0 and load best checkpoint weights."""
    model = models.efficientnet_b0(weights=None)  # No pretrained, we load our own

    # Rebuild the same classifier head used during training
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(512, 2)
    )

    # Load checkpoint
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()

    return model, checkpoint


def main():
    print("=" * 70)
    print("  DiagnoVision -- Step 8: Test Set Evaluation")
    print("=" * 70)
    print()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")

    # Create results directory
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1. Load model ─────────────────────────────────────────
    print()
    print("  1. LOADING BEST CHECKPOINT")
    print("  " + "-" * 60)

    model, checkpoint = build_model(device, CHECKPOINT_PATH)
    print(f"  Checkpoint: {CHECKPOINT_PATH}")
    print(f"  Best epoch: {checkpoint.get('epoch', 'N/A')}")
    print(f"  Val loss:   {checkpoint.get('val_loss', 'N/A'):.4f}")
    print(f"  Val acc:    {checkpoint.get('val_acc', 'N/A'):.2f}%")
    print()

    # ── 2. Load test data ─────────────────────────────────────
    print("  2. LOADING TEST DATA")
    print("  " + "-" * 60)

    test_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    test_dataset = datasets.ImageFolder(DATA_ROOT / "test", transform=test_transform)
    test_loader = DataLoader(
        test_dataset, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS, pin_memory=True
    )

    print(f"  Test images: {len(test_dataset)}")
    print(f"  Class mapping: {test_dataset.class_to_idx}")
    label_counts = Counter([l for _, l in test_dataset.samples])
    for idx, name in enumerate(CLASS_NAMES):
        print(f"    {name}: {label_counts[idx]}")
    print()

    # ── 3. Run inference ──────────────────────────────────────
    print("  3. RUNNING INFERENCE ON TEST SET")
    print("  " + "-" * 60)

    all_preds = []
    all_labels = []
    all_probs = []

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            probs = torch.softmax(outputs, dim=1)
            _, predicted = outputs.max(1)

            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.numpy())
            all_probs.extend(probs.cpu().numpy())

    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)
    all_probs = np.array(all_probs)

    print(f"  Inference complete: {len(all_preds)} predictions")
    print()

    # ── 4. Compute metrics ────────────────────────────────────
    print("  4. TEST SET METRICS")
    print("  " + "-" * 60)

    acc = accuracy_score(all_labels, all_preds)
    precision = precision_score(all_labels, all_preds, average='binary', pos_label=1)
    recall = recall_score(all_labels, all_preds, average='binary', pos_label=1)
    f1 = f1_score(all_labels, all_preds, average='binary', pos_label=1)
    cm = confusion_matrix(all_labels, all_preds)

    # Per-class metrics
    precision_per = precision_score(all_labels, all_preds, average=None)
    recall_per = recall_score(all_labels, all_preds, average=None)
    f1_per = f1_score(all_labels, all_preds, average=None)

    print(f"  Overall Accuracy:  {acc * 100:.2f}%")
    print(f"  Precision (PNEU):  {precision * 100:.2f}%")
    print(f"  Recall (PNEU):     {recall * 100:.2f}%")
    print(f"  F1 Score (PNEU):   {f1 * 100:.2f}%")
    print()

    # Confusion matrix
    print("  Confusion Matrix:")
    print(f"                    Predicted")
    print(f"                    NORMAL  PNEUMONIA")
    print(f"  Actual NORMAL     {cm[0][0]:>6}    {cm[0][1]:>6}")
    print(f"  Actual PNEUMONIA  {cm[1][0]:>6}    {cm[1][1]:>6}")
    print()

    # Detailed classification report
    print("  Classification Report:")
    print("  " + "-" * 60)
    report = classification_report(all_labels, all_preds, target_names=CLASS_NAMES, digits=4)
    for line in report.split('\n'):
        print(f"  {line}")
    print()

    # Clinical metrics (for pneumonia screening context)
    tn, fp, fn, tp = cm.ravel()
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0  # Same as recall
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    ppv = tp / (tp + fp) if (tp + fp) > 0 else 0  # Same as precision
    npv = tn / (tn + fn) if (tn + fn) > 0 else 0

    print("  Clinical Metrics (Pneumonia Screening):")
    print("  " + "-" * 60)
    print(f"  Sensitivity (Recall):     {sensitivity * 100:.2f}%  (catches sick patients)")
    print(f"  Specificity:              {specificity * 100:.2f}%  (avoids false alarms)")
    print(f"  PPV (Precision):          {ppv * 100:.2f}%  (positive results are correct)")
    print(f"  NPV:                      {npv * 100:.2f}%  (negative results are correct)")
    print(f"  False Negative Rate:      {(fn / (fn + tp)) * 100:.2f}%  (missed cases)")
    print(f"  False Positive Rate:      {(fp / (fp + tn)) * 100:.2f}%  (unnecessary referrals)")
    print()

    # ── 5. Save confusion matrix plot ─────────────────────────
    print("  5. SAVING RESULTS")
    print("  " + "-" * 60)

    # Confusion matrix heatmap
    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(cm, interpolation='nearest', cmap='Blues')
    ax.figure.colorbar(im, ax=ax)

    ax.set(
        xticks=[0, 1], yticks=[0, 1],
        xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES,
        xlabel='Predicted Label', ylabel='True Label',
        title=f'DiagnoVision -- Confusion Matrix (Test Set)\nAccuracy: {acc*100:.2f}%'
    )

    # Add text annotations
    thresh = cm.max() / 2.0
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f'{cm[i, j]}\n({cm[i,j]/cm.sum()*100:.1f}%)',
                    ha="center", va="center", fontsize=14, fontweight="bold",
                    color="white" if cm[i, j] > thresh else "black")

    plt.tight_layout()
    cm_path = RESULTS_DIR / "confusion_matrix.png"
    plt.savefig(cm_path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  Confusion matrix plot: {cm_path}")

    # Save metrics to JSON
    metrics = {
        "test_set_size": len(test_dataset),
        "accuracy": round(acc * 100, 2),
        "precision_pneumonia": round(precision * 100, 2),
        "recall_pneumonia": round(recall * 100, 2),
        "f1_pneumonia": round(f1 * 100, 2),
        "sensitivity": round(sensitivity * 100, 2),
        "specificity": round(specificity * 100, 2),
        "ppv": round(ppv * 100, 2),
        "npv": round(npv * 100, 2),
        "false_negative_rate": round((fn / (fn + tp)) * 100, 2),
        "false_positive_rate": round((fp / (fp + tn)) * 100, 2),
        "confusion_matrix": {
            "true_normal_pred_normal": int(tn),
            "true_normal_pred_pneumonia": int(fp),
            "true_pneumonia_pred_normal": int(fn),
            "true_pneumonia_pred_pneumonia": int(tp)
        },
        "per_class": {
            "NORMAL": {
                "precision": round(precision_per[0] * 100, 2),
                "recall": round(recall_per[0] * 100, 2),
                "f1": round(f1_per[0] * 100, 2),
                "support": int(label_counts[0])
            },
            "PNEUMONIA": {
                "precision": round(precision_per[1] * 100, 2),
                "recall": round(recall_per[1] * 100, 2),
                "f1": round(f1_per[1] * 100, 2),
                "support": int(label_counts[1])
            }
        },
        "checkpoint": {
            "path": str(CHECKPOINT_PATH),
            "best_epoch": checkpoint.get('epoch', 'N/A'),
            "val_loss": round(checkpoint.get('val_loss', 0), 4),
            "val_acc": round(checkpoint.get('val_acc', 0), 2)
        }
    }

    metrics_path = RESULTS_DIR / "test_metrics.json"
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"  Metrics JSON: {metrics_path}")

    # Save text report
    report_path = RESULTS_DIR / "test_report.txt"
    with open(report_path, 'w') as f:
        f.write("DiagnoVision -- Test Set Evaluation Report\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Test Set Size: {len(test_dataset)}\n")
        f.write(f"Best Epoch:    {checkpoint.get('epoch', 'N/A')}\n")
        f.write(f"Val Loss:      {checkpoint.get('val_loss', 'N/A'):.4f}\n")
        f.write(f"Val Accuracy:  {checkpoint.get('val_acc', 'N/A'):.2f}%\n\n")
        f.write(f"Test Accuracy:      {acc * 100:.2f}%\n")
        f.write(f"Precision (PNEU):   {precision * 100:.2f}%\n")
        f.write(f"Recall (PNEU):      {recall * 100:.2f}%\n")
        f.write(f"F1 Score (PNEU):    {f1 * 100:.2f}%\n\n")
        f.write(f"Sensitivity:        {sensitivity * 100:.2f}%\n")
        f.write(f"Specificity:        {specificity * 100:.2f}%\n")
        f.write(f"PPV:                {ppv * 100:.2f}%\n")
        f.write(f"NPV:                {npv * 100:.2f}%\n\n")
        f.write("Confusion Matrix:\n")
        f.write(f"                 Predicted NORMAL  Predicted PNEUMONIA\n")
        f.write(f"Actual NORMAL         {tn:>6}              {fp:>6}\n")
        f.write(f"Actual PNEUMONIA      {fn:>6}              {tp:>6}\n\n")
        f.write("Classification Report:\n")
        f.write(report + "\n")
    print(f"  Text report: {report_path}")
    print()

    # ── Summary ────────────────────────────────────────────────
    print("=" * 70)
    print("  EVALUATION COMPLETE")
    print(f"  Test Accuracy:  {acc * 100:.2f}%")
    print(f"  F1 (Pneumonia): {f1 * 100:.2f}%")
    print(f"  Sensitivity:    {sensitivity * 100:.2f}% | Specificity: {specificity * 100:.2f}%")
    print("=" * 70)


if __name__ == "__main__":
    main()
