"""
DiagnoVision -- Step 7: Evaluation
Evaluates the best checkpoint on the ORIGINAL held-out test set
(chest_xray/test/, untouched by any re-splitting).
Reports accuracy, precision, recall, F1, confusion matrix.
Saves all metrics to results/test_metrics.json and results/test_report.txt
and a confusion matrix heatmap to results/confusion_matrix.png.
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

# ── Configuration ──────────────────────────────────────────────
# Use the ORIGINAL test set, untouched by resplit_data.py
ORIGINAL_TEST_DIR = Path(r"D:\DiagnoVision\chest_xray\test")
CHECKPOINT_PATH   = Path(r"D:\DiagnoVision\checkpoints\best_model.pth")
RESULTS_DIR       = Path(r"D:\DiagnoVision\results")
IMAGE_SIZE  = 224
BATCH_SIZE  = 32
NUM_WORKERS = 0

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]
CLASS_NAMES   = ["NORMAL", "PNEUMONIA"]


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
    print("  DiagnoVision -- Step 7: Test Set Evaluation")
    print("  (Original chest_xray/test/, untouched by re-splitting)")
    print("=" * 70)
    print()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")
    if device.type == "cuda":
        print(f"  GPU:    {torch.cuda.get_device_name(0)}")

    # Create results directory
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1. Load model ─────────────────────────────────────────
    print()
    print("  1. LOADING BEST CHECKPOINT")
    print("  " + "-" * 60)

    model, checkpoint = build_model(device, CHECKPOINT_PATH)
    best_epoch = checkpoint.get('epoch', 'N/A')
    val_loss   = checkpoint.get('val_loss', float('nan'))
    val_acc    = checkpoint.get('val_acc', float('nan'))

    print(f"  Checkpoint: {CHECKPOINT_PATH}")
    print(f"  Best epoch: {best_epoch}")
    print(f"  Val loss:   {val_loss:.4f}")
    print(f"  Val acc:    {val_acc:.2f}%")
    print()

    # ── 2. Load test data ─────────────────────────────────────
    print("  2. LOADING ORIGINAL TEST DATA")
    print("  " + "-" * 60)
    print(f"  Source: {ORIGINAL_TEST_DIR}")

    test_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    test_dataset = datasets.ImageFolder(ORIGINAL_TEST_DIR, transform=test_transform)
    test_loader  = DataLoader(
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

    all_preds  = []
    all_labels = []
    all_probs  = []
    all_paths  = [p for p, _ in test_dataset.samples]   # track per-image paths

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            probs = torch.softmax(outputs, dim=1)
            _, predicted = outputs.max(1)

            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.numpy())
            all_probs.extend(probs.cpu().numpy())

    all_preds  = np.array(all_preds)
    all_labels = np.array(all_labels)
    all_probs  = np.array(all_probs)

    print(f"  Inference complete: {len(all_preds)} predictions")
    print()

    # ── 4. Compute overall metrics ────────────────────────────
    print("  4. OVERALL TEST SET METRICS")
    print("  " + "-" * 60)

    acc       = accuracy_score(all_labels, all_preds)
    precision = precision_score(all_labels, all_preds, average='binary', pos_label=1)
    recall    = recall_score(all_labels, all_preds, average='binary', pos_label=1)
    f1        = f1_score(all_labels, all_preds, average='binary', pos_label=1)
    cm        = confusion_matrix(all_labels, all_preds)

    # Per-class metrics
    precision_per = precision_score(all_labels, all_preds, average=None)
    recall_per    = recall_score(all_labels, all_preds, average=None)
    f1_per        = f1_score(all_labels, all_preds, average=None)

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
    ppv = tp / (tp + fp) if (tp + fp) > 0 else 0          # Same as precision
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

    # ── 5. Per-Class Subgroup Breakdown ───────────────────────
    print("  5. SUBGROUP BREAKDOWN (PER-CLASS)")
    print("  " + "-" * 60)
    print()
    print("  NOTE: All test images originate from the original chest_xray/test/")
    print("        folder, which was never touched by the re-splitting process.")
    print("        No additional subgroup metadata (e.g., patient origin, original")
    print("        split provenance) was tracked, so the per-class breakdown is")
    print("        the finest available grouping.")
    print()

    for cls_idx, cls_name in enumerate(CLASS_NAMES):
        mask = all_labels == cls_idx
        cls_preds  = all_preds[mask]
        cls_labels = all_labels[mask]
        n_total    = int(mask.sum())
        n_correct  = int((cls_preds == cls_labels).sum())
        n_wrong    = n_total - n_correct
        cls_acc    = n_correct / n_total * 100 if n_total > 0 else 0

        # Per-class confidence stats
        cls_probs = all_probs[mask]
        correct_mask = cls_preds == cls_labels
        avg_conf_correct = cls_probs[correct_mask, cls_idx].mean() * 100 if correct_mask.sum() > 0 else 0
        avg_conf_wrong   = cls_probs[~correct_mask, 1 - cls_idx].mean() * 100 if (~correct_mask).sum() > 0 else 0

        print(f"  {cls_name}:")
        print(f"    Total samples:         {n_total}")
        print(f"    Correctly classified:  {n_correct} ({cls_acc:.2f}%)")
        print(f"    Misclassified:         {n_wrong} ({100 - cls_acc:.2f}%)")
        print(f"    Precision:             {precision_per[cls_idx] * 100:.2f}%")
        print(f"    Recall:                {recall_per[cls_idx] * 100:.2f}%")
        print(f"    F1:                    {f1_per[cls_idx] * 100:.2f}%")
        print(f"    Avg confidence (correct):  {avg_conf_correct:.1f}%")
        if n_wrong > 0:
            print(f"    Avg confidence (wrong):    {avg_conf_wrong:.1f}%")
        print()

    # ── 6. Save confusion matrix plot ─────────────────────────
    print("  6. SAVING RESULTS")
    print("  " + "-" * 60)

    # Confusion matrix heatmap
    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(cm, interpolation='nearest', cmap='Blues')
    ax.figure.colorbar(im, ax=ax)

    ax.set(
        xticks=[0, 1], yticks=[0, 1],
        xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES,
        xlabel='Predicted Label', ylabel='True Label',
        title=f'DiagnoVision -- Confusion Matrix (Original Test Set)\nAccuracy: {acc*100:.2f}%'
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
        "evaluation_timestamp": datetime.datetime.now().isoformat(),
        "test_set_source": str(ORIGINAL_TEST_DIR),
        "test_set_note": "Original chest_xray/test/, untouched by re-splitting",
        "test_set_size": len(test_dataset),
        "overall": {
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
        },
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
        "subgroup_note": "No additional subgroup metadata was tracked during re-splitting. "
                         "The test set was copied as-is from the original data. "
                         "Per-class breakdown above is the finest available grouping.",
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
        f.write("=" * 60 + "\n")
        f.write(f"Date:          {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Test source:   {ORIGINAL_TEST_DIR}\n")
        f.write(f"Note:          Original test set, untouched by re-splitting\n\n")
        f.write(f"Test Set Size: {len(test_dataset)}\n")
        f.write(f"  NORMAL:      {label_counts[0]}\n")
        f.write(f"  PNEUMONIA:   {label_counts[1]}\n\n")
        f.write(f"Best Epoch:    {best_epoch}\n")
        f.write(f"Val Loss:      {val_loss:.4f}\n")
        f.write(f"Val Accuracy:  {val_acc:.2f}%\n\n")

        f.write("OVERALL METRICS\n")
        f.write("-" * 40 + "\n")
        f.write(f"Test Accuracy:      {acc * 100:.2f}%\n")
        f.write(f"Precision (PNEU):   {precision * 100:.2f}%\n")
        f.write(f"Recall (PNEU):      {recall * 100:.2f}%\n")
        f.write(f"F1 Score (PNEU):    {f1 * 100:.2f}%\n\n")

        f.write("CLINICAL METRICS\n")
        f.write("-" * 40 + "\n")
        f.write(f"Sensitivity:        {sensitivity * 100:.2f}%\n")
        f.write(f"Specificity:        {specificity * 100:.2f}%\n")
        f.write(f"PPV:                {ppv * 100:.2f}%\n")
        f.write(f"NPV:                {npv * 100:.2f}%\n")
        f.write(f"False Negative Rate:{(fn / (fn + tp)) * 100:.2f}%\n")
        f.write(f"False Positive Rate:{(fp / (fp + tn)) * 100:.2f}%\n\n")

        f.write("CONFUSION MATRIX\n")
        f.write("-" * 40 + "\n")
        f.write(f"                 Predicted NORMAL  Predicted PNEUMONIA\n")
        f.write(f"Actual NORMAL         {tn:>6}              {fp:>6}\n")
        f.write(f"Actual PNEUMONIA      {fn:>6}              {tp:>6}\n\n")

        f.write("PER-CLASS SUBGROUP BREAKDOWN\n")
        f.write("-" * 40 + "\n")
        for cls_idx, cls_name in enumerate(CLASS_NAMES):
            mask = all_labels == cls_idx
            n_total = int(mask.sum())
            n_correct = int((all_preds[mask] == all_labels[mask]).sum())
            f.write(f"{cls_name}:\n")
            f.write(f"  Support:    {n_total}\n")
            f.write(f"  Accuracy:   {n_correct/n_total*100:.2f}%\n")
            f.write(f"  Precision:  {precision_per[cls_idx]*100:.2f}%\n")
            f.write(f"  Recall:     {recall_per[cls_idx]*100:.2f}%\n")
            f.write(f"  F1:         {f1_per[cls_idx]*100:.2f}%\n\n")

        f.write("FULL CLASSIFICATION REPORT\n")
        f.write("-" * 40 + "\n")
        f.write(report + "\n")

    print(f"  Text report: {report_path}")
    print()

    # ── Summary ────────────────────────────────────────────────
    print("=" * 70)
    print("  EVALUATION COMPLETE")
    print(f"  Test Source:    {ORIGINAL_TEST_DIR}")
    print(f"  Test Accuracy:  {acc * 100:.2f}%")
    print(f"  F1 (Pneumonia): {f1 * 100:.2f}%")
    print(f"  Sensitivity:    {sensitivity * 100:.2f}% | Specificity: {specificity * 100:.2f}%")
    print("=" * 70)


if __name__ == "__main__":
    main()
