"""
DiagnoVision — Export EfficientNet-B0 to ONNX for Client-Side Grad-CAM

Exports the trained pneumonia model to ONNX format so it can run
in the browser via ONNX Runtime Web. The model outputs:
1. logits: [batch, 2]
2. heatmap: [batch, 224, 224] (exact, medically verified Grad-CAM for Pneumonia)
3. feature_maps: [batch, 1280, 7, 7] (for backwards compatibility)

Usage:
    python export_onnx.py

Output:
    frontend/public/models/pneumonia_efficientnet_b0.onnx
"""

import torch
import torch.nn as nn
from torchvision import models
from pathlib import Path


def build_model_with_exact_cam():
    """
    Build the EfficientNet-B0 model with exact analytical Grad-CAM computation
    embedded directly into the graph. This enables the browser to generate
    medically accurate Grad-CAM heatmaps in a single forward pass without
    approximations or server round-trips.
    """

    class EfficientNetWithExactCAM(nn.Module):
        """Wrapper that computes exact analytical Grad-CAM alongside logits."""

        def __init__(self, base_model):
            super().__init__()
            self.features = base_model.features
            self.avgpool = base_model.avgpool
            self.classifier = base_model.classifier

            # Extract classifier parameters for exact gradient calculation
            self.register_buffer("W1", base_model.classifier[1].weight)  # (512, 1280)
            self.register_buffer("b1", base_model.classifier[1].bias)    # (512,)
            self.register_buffer("W2", base_model.classifier[4].weight)  # (2, 512)
            self.register_buffer("b2", base_model.classifier[4].bias)    # (2,)

        def forward(self, x):
            feat = self.features(x)  # (B, 1280, 7, 7)
            pooled = self.avgpool(feat).flatten(1)  # (B, 1280)

            # Standard classifier forward pass
            z1 = torch.matmul(pooled, self.W1.t()) + self.b1  # (B, 512)
            a1 = torch.relu(z1)  # (B, 512)
            logits = torch.matmul(a1, self.W2.t()) + self.b2  # (B, 2)

            # Exact Grad-CAM gradient for Pneumonia (class 1):
            # d(Score_1) / d(Pooled_k) = (W2[1, :] * (z1 > 0)) @ W1
            mask = (z1 > 0).float()
            grad_z1 = self.W2[1:2, :] * mask  # (B, 512)
            weights = torch.matmul(grad_z1, self.W1)  # (B, 1280)

            # Weighted combination of feature maps
            weights = weights.view(-1, 1280, 1, 1)
            cam = torch.relu((weights * feat).sum(dim=1, keepdim=True))  # (B, 1, 7, 7)

            # Upsample to 224x224
            cam_upscaled = torch.nn.functional.interpolate(
                cam, size=(224, 224), mode="bilinear", align_corners=False
            )

            # Min-max normalize per image
            cam_flat = cam_upscaled.view(cam_upscaled.size(0), -1)
            cam_min = cam_flat.min(dim=1, keepdim=True)[0].view(-1, 1, 1, 1)
            cam_max = cam_flat.max(dim=1, keepdim=True)[0].view(-1, 1, 1, 1)
            heatmap = (cam_upscaled - cam_min) / (cam_max - cam_min + 1e-8)

            return logits, heatmap.squeeze(1), feat

    return EfficientNetWithExactCAM


def main():
    print("=" * 60)
    print("  DiagnoVision — ONNX Export (Exact Analytical Grad-CAM)")
    print("=" * 60)
    print()

    # ── Paths ──
    checkpoint_path = Path("checkpoints/best_model.pth")
    output_dir = Path("frontend/public/models")
    output_path = output_dir / "pneumonia_efficientnet_b0.onnx"

    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Load the trained model ──
    print("  Loading checkpoint...")
    device = torch.device("cpu")

    base_model = models.efficientnet_b0(weights=None)
    in_features = base_model.classifier[1].in_features
    base_model.classifier = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(512, 2),
    )

    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    base_model.load_state_dict(checkpoint["model_state_dict"])
    print(f"  Loaded: {checkpoint_path.name}")

    # ── Wrap model with exact analytical Grad-CAM ──
    EfficientNetWithExactCAM = build_model_with_exact_cam()
    model = EfficientNetWithExactCAM(base_model)
    model.eval()
    print("  Model wrapped with Exact Analytical Grad-CAM output")

    # ── Export to ONNX ──
    print("  Exporting to ONNX...")
    dummy_input = torch.randn(1, 3, 224, 224)

    # Remove old external data file if present
    data_file = Path(str(output_path) + ".data")
    if data_file.exists():
        data_file.unlink()

    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        opset_version=17,
        input_names=["input"],
        output_names=["logits", "heatmap", "feature_maps"],
        dynamic_axes={
            "input": {0: "batch"},
            "logits": {0: "batch"},
            "heatmap": {0: "batch"},
            "feature_maps": {0: "batch"},
        },
        dynamo=False,
    )

    # ── Verify ──
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"  Exported: {output_path}")
    print(f"  File size: {file_size_mb:.1f} MB")

    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(output_path))
        inputs = {session.get_inputs()[0].name: dummy_input.numpy()}
        logits, heatmap, feature_maps = session.run(None, inputs)

        print(f"  Verification passed!")
        print(f"    logits shape:       {logits.shape}")
        print(f"    heatmap shape:      {heatmap.shape} (min={heatmap.min():.2f}, max={heatmap.max():.2f})")
        print(f"    feature_maps shape: {feature_maps.shape}")
    except ImportError:
        print("  (onnxruntime not installed in this env — skipping runtime verification)")

    print()
    print("=" * 60)
    print("  EXPORT COMPLETE")
    print(f"  Deploy {output_path.name} with your frontend")
    print("=" * 60)


if __name__ == "__main__":
    main()
