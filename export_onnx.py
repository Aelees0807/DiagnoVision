"""
DiagnoVision — Export EfficientNet-B0 to ONNX for Client-Side Grad-CAM

Exports the trained pneumonia model to ONNX format so it can run
in the browser via ONNX Runtime Web. The export includes an intermediate
output from the final convolutional layer (features[-1]) which is needed
for the client-side Grad-CAM computation.

Usage:
    python export_onnx.py

Output:
    frontend/public/models/pneumonia_efficientnet_b0.onnx
"""

import torch
import torch.nn as nn
from torchvision import models
from pathlib import Path


def build_model_with_features_output():
    """
    Build the EfficientNet-B0 model with the same architecture used during
    training, but modified to also output the final conv layer activations
    needed for Grad-CAM.
    """

    class EfficientNetWithFeatures(nn.Module):
        """Wrapper that exposes the final conv layer activations alongside logits."""

        def __init__(self, base_model):
            super().__init__()
            self.features = base_model.features
            self.avgpool = base_model.avgpool
            self.classifier = base_model.classifier

        def forward(self, x):
            # Get features from all convolutional blocks
            feature_maps = self.features(x)  # (B, 1280, 7, 7)

            # Standard classification path
            pooled = self.avgpool(feature_maps)  # (B, 1280, 1, 1)
            pooled = torch.flatten(pooled, 1)  # (B, 1280)
            logits = self.classifier(pooled)  # (B, 2)

            # Return both logits AND the feature maps for Grad-CAM
            return logits, feature_maps

    return EfficientNetWithFeatures


def main():
    print("=" * 60)
    print("  DiagnoVision — ONNX Export")
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

    # Build base model with same architecture as training
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

    # ── Wrap model to expose feature maps ──
    EfficientNetWithFeatures = build_model_with_features_output()
    model = EfficientNetWithFeatures(base_model)
    model.eval()
    print("  Model wrapped with feature map output")

    # ── Export to ONNX ──
    print("  Exporting to ONNX...")
    dummy_input = torch.randn(1, 3, 224, 224)

    torch.onnx.export(
        model,
        dummy_input,
        str(output_path),
        opset_version=17,
        input_names=["input"],
        output_names=["logits", "feature_maps"],
        dynamic_axes={
            "input": {0: "batch"},
            "logits": {0: "batch"},
            "feature_maps": {0: "batch"},
        },
    )

    # ── Verify ──
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"  Exported: {output_path}")
    print(f"  File size: {file_size_mb:.1f} MB")

    # Quick verification with ONNX Runtime (if installed)
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(output_path))
        inputs = {session.get_inputs()[0].name: dummy_input.numpy()}
        logits, feature_maps = session.run(None, inputs)

        print(f"  Verification passed!")
        print(f"    logits shape:       {logits.shape}")
        print(f"    feature_maps shape: {feature_maps.shape}")
    except ImportError:
        print("  (onnxruntime not installed — skipping verification)")
        print("  Install with: pip install onnxruntime")

    print()
    print("=" * 60)
    print("  EXPORT COMPLETE")
    print(f"  Deploy {output_path.name} with your frontend (Cloudflare Pages)")
    print("=" * 60)


if __name__ == "__main__":
    main()
