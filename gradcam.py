"""
DiagnoVision -- Step 8: Grad-CAM Visualization
Generates Grad-CAM heatmaps on the final convolutional layer (features[-1])
of EfficientNet-B0 for selected test images.
Outputs a presentation-ready comparison grid.
"""

import random
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import datasets, transforms, models
import numpy as np
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

# ── Configuration ──────────────────────────────────────────────
ORIGINAL_TEST_DIR = Path(r"D:\DiagnoVision\chest_xray\test")
CHECKPOINT_PATH   = Path(r"D:\DiagnoVision\checkpoints\best_model.pth")
RESULTS_DIR       = Path(r"D:\DiagnoVision\results")
IMAGE_SIZE  = 224
NUM_IMAGES  = 6     # Total images to show in the grid

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]
CLASS_NAMES   = ["NORMAL", "PNEUMONIA"]

random.seed(42)
np.random.seed(42)


# ── Grad-CAM Implementation ───────────────────────────────────
class GradCAM:
    """Grad-CAM for a target convolutional layer."""

    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        # Register hooks
        target_layer.register_forward_hook(self._forward_hook)
        target_layer.register_full_backward_hook(self._backward_hook)

    def _forward_hook(self, module, input, output):
        self.activations = output.detach()

    def _backward_hook(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor, target_class=None):
        """
        Generate Grad-CAM heatmap.
        If target_class is None, uses the predicted class.
        Returns the heatmap as a numpy array (H, W) in [0, 1].
        """
        self.model.eval()
        output = self.model(input_tensor)

        if target_class is None:
            target_class = output.argmax(dim=1).item()

        # Zero all gradients
        self.model.zero_grad()

        # Backprop from the target class score
        target_score = output[0, target_class]
        target_score.backward(retain_graph=True)

        # Pool gradients over spatial dims -> channel weights
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)  # [1, C, 1, 1]

        # Weighted combination of activations
        cam = (weights * self.activations).sum(dim=1, keepdim=True)  # [1, 1, H, W]
        cam = F.relu(cam)  # Only positive contributions

        # Upsample to input size
        cam = F.interpolate(cam, size=(IMAGE_SIZE, IMAGE_SIZE),
                            mode='bilinear', align_corners=False)

        # Normalize to [0, 1]
        cam = cam.squeeze().cpu().numpy()
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max - cam_min > 1e-8:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = np.zeros_like(cam)

        return cam, output


def load_original_image(path):
    """Load and resize original image (no normalization) for display."""
    img = Image.open(path).convert("RGB")
    img = img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS)
    return np.array(img)


def build_model(device, checkpoint_path):
    """Build EfficientNet-B0 and load best checkpoint."""
    model = models.efficientnet_b0(weights=None)

    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(512, 2)
    )

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()

    return model, checkpoint


def main():
    print("=" * 70)
    print("  DiagnoVision -- Step 8: Grad-CAM Visualization")
    print("=" * 70)
    print()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # ── 1. Load model ─────────────────────────────────────────
    print()
    print("  1. LOADING MODEL")
    print("  " + "-" * 60)

    model, checkpoint = build_model(device, CHECKPOINT_PATH)
    print(f"  Checkpoint: {CHECKPOINT_PATH}")
    print(f"  Best epoch: {checkpoint.get('epoch', 'N/A')}")
    print()

    # Target layer: final convolutional block (features[8] = last MBConv block)
    target_layer = model.features[-1]
    print(f"  Grad-CAM target layer: model.features[-1]  (final conv block)")
    print()

    # ── 2. Run inference on all test images ───────────────────
    print("  2. CLASSIFYING ALL TEST IMAGES")
    print("  " + "-" * 60)

    test_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    test_dataset = datasets.ImageFolder(ORIGINAL_TEST_DIR, transform=test_transform)
    print(f"  Test images: {len(test_dataset)}")

    # Classify every image and bucket by outcome
    correct_normal = []    # True NORMAL, predicted NORMAL
    correct_pneumonia = [] # True PNEUMONIA, predicted PNEUMONIA
    false_positive = []    # True NORMAL, predicted PNEUMONIA
    false_negative = []    # True PNEUMONIA, predicted NORMAL

    with torch.no_grad():
        for idx in range(len(test_dataset)):
            img_tensor, true_label = test_dataset[idx]
            img_path = test_dataset.samples[idx][0]
            output = model(img_tensor.unsqueeze(0).to(device))
            probs = torch.softmax(output, dim=1)
            pred_label = output.argmax(dim=1).item()
            conf = probs[0, pred_label].item()

            entry = {
                "idx": idx,
                "path": img_path,
                "true_label": true_label,
                "pred_label": pred_label,
                "confidence": conf,
                "true_name": CLASS_NAMES[true_label],
                "pred_name": CLASS_NAMES[pred_label],
            }

            if true_label == 0 and pred_label == 0:
                correct_normal.append(entry)
            elif true_label == 1 and pred_label == 1:
                correct_pneumonia.append(entry)
            elif true_label == 0 and pred_label == 1:
                false_positive.append(entry)
            elif true_label == 1 and pred_label == 0:
                false_negative.append(entry)

    print(f"  Correct NORMAL:    {len(correct_normal)}")
    print(f"  Correct PNEUMONIA: {len(correct_pneumonia)}")
    print(f"  False Positive:    {len(false_positive)}  (NORMAL -> predicted PNEUMONIA)")
    print(f"  False Negative:    {len(false_negative)}  (PNEUMONIA -> predicted NORMAL)")
    print()

    # ── 3. Select representative images ───────────────────────
    print("  3. SELECTING IMAGES FOR GRAD-CAM")
    print("  " + "-" * 60)

    # Strategy: 2 correct NORMAL, 2 correct PNEUMONIA, 1 FP, 1 FN
    # Sort by confidence for interesting picks
    selected = []

    # Pick 2 correct NORMAL (1 high conf, 1 lower conf)
    correct_normal.sort(key=lambda x: x["confidence"], reverse=True)
    if len(correct_normal) >= 2:
        selected.append(correct_normal[0])                                    # highest conf
        mid = len(correct_normal) // 2
        selected.append(correct_normal[mid])                                  # mid conf
    elif correct_normal:
        selected.append(correct_normal[0])

    # Pick 2 correct PNEUMONIA (1 high conf, 1 lower conf)
    correct_pneumonia.sort(key=lambda x: x["confidence"], reverse=True)
    if len(correct_pneumonia) >= 2:
        selected.append(correct_pneumonia[0])
        mid = len(correct_pneumonia) // 2
        selected.append(correct_pneumonia[mid])
    elif correct_pneumonia:
        selected.append(correct_pneumonia[0])

    # Pick 1 FP (highest confidence -- the model was most "sure" but wrong)
    false_positive.sort(key=lambda x: x["confidence"], reverse=True)
    if false_positive:
        selected.append(false_positive[0])

    # Pick 1 FN (highest confidence -- most confident wrong "normal")
    false_negative.sort(key=lambda x: x["confidence"], reverse=True)
    if false_negative:
        selected.append(false_negative[0])

    # Cap at NUM_IMAGES
    selected = selected[:NUM_IMAGES]

    for i, s in enumerate(selected):
        correct = "CORRECT" if s["true_label"] == s["pred_label"] else "WRONG"
        print(f"  [{i+1}] {correct:>7} | True: {s['true_name']:<10} Pred: {s['pred_name']:<10} "
              f"Conf: {s['confidence']*100:.1f}%  | {Path(s['path']).name}")
    print()

    # ── 4. Generate Grad-CAM heatmaps ─────────────────────────
    print("  4. GENERATING GRAD-CAM HEATMAPS")
    print("  " + "-" * 60)

    gradcam = GradCAM(model, target_layer)

    cam_results = []
    for i, s in enumerate(selected):
        img_tensor, _ = test_dataset[s["idx"]]
        input_tensor = img_tensor.unsqueeze(0).to(device)

        # Generate Grad-CAM for the PREDICTED class (shows what the model is looking at)
        cam, _ = gradcam.generate(input_tensor, target_class=s["pred_label"])

        # Load original image for overlay
        orig_img = load_original_image(s["path"])

        cam_results.append({
            "original": orig_img,
            "cam": cam,
            **s
        })
        print(f"  [{i+1}] Generated Grad-CAM for: {Path(s['path']).name}")

    print()

    # ── 5. Create comparison grid ─────────────────────────────
    print("  5. CREATING COMPARISON GRID")
    print("  " + "-" * 60)

    n_images = len(cam_results)

    # Layout: n_images rows × 2 columns (Original | Grad-CAM overlay)
    fig = plt.figure(figsize=(10, 3.6 * n_images + 1.2))

    gs = gridspec.GridSpec(
        n_images, 2,
        figure=fig,
        hspace=0.35,
        wspace=0.08,
        top=0.93,
        bottom=0.02,
        left=0.02,
        right=0.98,
    )

    fig.suptitle(
        "DiagnoVision — Grad-CAM Explanations",
        fontsize=18, fontweight="bold", y=0.97,
        fontfamily="sans-serif"
    )

    for row, r in enumerate(cam_results):
        correct = r["true_label"] == r["pred_label"]
        verdict = "✓ Correct" if correct else "✗ Wrong"
        verdict_color = "#2ecc71" if correct else "#e74c3c"

        # -- Left column: Original image --
        ax_orig = fig.add_subplot(gs[row, 0])
        ax_orig.imshow(r["original"])
        ax_orig.set_xticks([])
        ax_orig.set_yticks([])

        title_text = f"True: {r['true_name']}"
        ax_orig.set_title(title_text, fontsize=11, fontweight="bold", pad=6)

        # Add filename below
        ax_orig.set_xlabel(
            Path(r["path"]).name,
            fontsize=7, color="#888888", labelpad=2
        )

        # -- Right column: Grad-CAM overlay --
        ax_cam = fig.add_subplot(gs[row, 1])
        ax_cam.imshow(r["original"])
        ax_cam.imshow(r["cam"], cmap="jet", alpha=0.45)
        ax_cam.set_xticks([])
        ax_cam.set_yticks([])

        cam_title = f"Pred: {r['pred_name']} ({r['confidence']*100:.1f}%)  —  {verdict}"
        ax_cam.set_title(cam_title, fontsize=11, fontweight="bold", color=verdict_color, pad=6)

        # Border color for incorrect predictions
        if not correct:
            for spine in ax_orig.spines.values():
                spine.set_edgecolor("#e74c3c")
                spine.set_linewidth(3)
            for spine in ax_cam.spines.values():
                spine.set_edgecolor("#e74c3c")
                spine.set_linewidth(3)
        else:
            for spine in ax_orig.spines.values():
                spine.set_edgecolor("#2ecc71")
                spine.set_linewidth(2)
            for spine in ax_cam.spines.values():
                spine.set_edgecolor("#2ecc71")
                spine.set_linewidth(2)

    # Column headers
    fig.text(0.26, 0.945, "Original X-Ray", ha="center", fontsize=13,
             fontweight="bold", color="#555555")
    fig.text(0.76, 0.945, "Grad-CAM Heatmap", ha="center", fontsize=13,
             fontweight="bold", color="#555555")

    grid_path = RESULTS_DIR / "gradcam_grid.png"
    fig.savefig(grid_path, dpi=180, facecolor="white", bbox_inches="tight")
    plt.close(fig)

    print(f"  Grid saved: {grid_path}")
    print()

    # ── 6. Also save individual overlays ──────────────────────
    print("  6. SAVING INDIVIDUAL HEATMAPS")
    print("  " + "-" * 60)

    individual_dir = RESULTS_DIR / "gradcam_individual"
    individual_dir.mkdir(parents=True, exist_ok=True)

    for i, r in enumerate(cam_results):
        fig_ind, (ax1, ax2) = plt.subplots(1, 2, figsize=(8, 4))
        fig_ind.suptitle(
            f"True: {r['true_name']}  |  Pred: {r['pred_name']} ({r['confidence']*100:.1f}%)",
            fontsize=12, fontweight="bold"
        )

        ax1.imshow(r["original"])
        ax1.set_title("Original", fontsize=10)
        ax1.axis("off")

        ax2.imshow(r["original"])
        ax2.imshow(r["cam"], cmap="jet", alpha=0.45)
        ax2.set_title("Grad-CAM Overlay", fontsize=10)
        ax2.axis("off")

        fname = Path(r["path"]).stem
        ind_path = individual_dir / f"gradcam_{i+1}_{fname}.png"
        fig_ind.savefig(ind_path, dpi=150, facecolor="white", bbox_inches="tight")
        plt.close(fig_ind)
        print(f"  [{i+1}] {ind_path.name}")

    print()

    # ── Summary ────────────────────────────────────────────────
    print("=" * 70)
    print("  GRAD-CAM COMPLETE")
    print(f"  Grid image:        {grid_path}")
    print(f"  Individual images: {individual_dir}")
    print(f"  Images processed:  {n_images}")
    print("=" * 70)


if __name__ == "__main__":
    main()
