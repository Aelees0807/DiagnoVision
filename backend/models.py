"""
DiagnoVision — Model Loading & Inference
Loads EfficientNet-B0 (pneumonia), MobileNetV3-Small (gatekeeper),
and provides Grad-CAM generation for visual explanations.
"""

import io
import base64
import time

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms, models
from PIL import Image
import numpy as np

from .config import (
    PNEUMONIA_CHECKPOINT,
    GATEKEEPER_CHECKPOINT,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    CLASS_NAMES,
    GATEKEEPER_CLASSES,
    CONFIDENCE_THRESHOLD,
)


# ── Singleton model holder ─────────────────────────────────────
class ModelRegistry:
    """Holds loaded models so they're initialized once at startup."""

    def __init__(self):
        self.device = None
        self.pneumonia_model = None
        self.gatekeeper_model = None
        self.gradcam = None
        self._loaded = False

    @property
    def is_loaded(self):
        return self._loaded

    def load_all(self):
        """Load both models and set up Grad-CAM. Called once at app startup."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"  [Models] Using device: {self.device}")

        self.pneumonia_model = self._load_pneumonia()
        self.gatekeeper_model = self._load_gatekeeper()

        # Grad-CAM targeting final conv block of EfficientNet-B0
        target_layer = self.pneumonia_model.features[-1]
        self.gradcam = GradCAM(self.pneumonia_model, target_layer)

        self._loaded = True
        print("  [Models] All models loaded successfully.")

    def _load_pneumonia(self):
        """Load EfficientNet-B0 with custom binary classifier head."""
        model = models.efficientnet_b0(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier = nn.Sequential(
            nn.Dropout(p=0.3, inplace=True),
            nn.Linear(in_features, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.2),
            nn.Linear(512, 2),
        )
        checkpoint = torch.load(
            PNEUMONIA_CHECKPOINT, map_location=self.device, weights_only=False
        )
        model.load_state_dict(checkpoint["model_state_dict"])
        model = model.to(self.device)
        model.eval()
        print(f"  [Models] Pneumonia model loaded from {PNEUMONIA_CHECKPOINT.name}")
        return model

    def _load_gatekeeper(self):
        """Load MobileNetV3-Small gatekeeper classifier."""
        model = models.mobilenet_v3_small(weights=None)
        in_features = model.classifier[0].in_features
        model.classifier = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.Hardswish(inplace=True),
            nn.Dropout(p=0.2),
            nn.Linear(256, 2),
        )
        checkpoint = torch.load(
            GATEKEEPER_CHECKPOINT, map_location=self.device, weights_only=False
        )
        model.load_state_dict(checkpoint["model_state_dict"])
        model = model.to(self.device)
        model.eval()
        print(f"  [Models] Gatekeeper model loaded from {GATEKEEPER_CHECKPOINT.name}")
        return model


# ── Grad-CAM ───────────────────────────────────────────────────
class GradCAM:
    """Grad-CAM for the final convolutional layer of EfficientNet-B0."""

    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        target_layer.register_forward_hook(self._forward_hook)
        target_layer.register_full_backward_hook(self._backward_hook)

    def _forward_hook(self, module, input, output):
        self.activations = output.detach()

    def _backward_hook(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor, target_class=None):
        """
        Generate Grad-CAM heatmap.
        Returns heatmap as numpy array (H, W) in [0, 1].
        """
        self.model.eval()

        # Need gradients for Grad-CAM
        input_tensor.requires_grad_(True)
        output = self.model(input_tensor)

        if target_class is None:
            target_class = output.argmax(dim=1).item()

        self.model.zero_grad()
        target_score = output[0, target_class]
        target_score.backward(retain_graph=True)

        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = F.interpolate(
            cam, size=(IMAGE_SIZE, IMAGE_SIZE), mode="bilinear", align_corners=False
        )

        cam = cam.squeeze().cpu().numpy()
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max - cam_min > 1e-8:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = np.zeros_like(cam)

        return cam


# ── Preprocessing ──────────────────────────────────────────────
def get_transform():
    """Standard inference transform matching training preprocessing."""
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )


def load_image(file_bytes: bytes) -> Image.Image:
    """Load image from raw bytes and convert to RGB."""
    return Image.open(io.BytesIO(file_bytes)).convert("RGB")


# ── Inference Functions ────────────────────────────────────────
def run_gatekeeper(registry: ModelRegistry, img_tensor: torch.Tensor) -> dict:
    """Run gatekeeper to check if image is a frontal chest X-ray."""
    with torch.no_grad():
        output = registry.gatekeeper_model(img_tensor)
        probs = torch.softmax(output, dim=1)
        pred_idx = output.argmax(dim=1).item()
        confidence = probs[0, pred_idx].item() * 100

    label = GATEKEEPER_CLASSES[pred_idx]
    result = "rejected" if label == "not_chest_xray" else "passed"

    return {
        "result": result,
        "confidence": round(confidence, 1),
        "label": label,
    }


def run_pneumonia_prediction(
    registry: ModelRegistry, img_tensor: torch.Tensor
) -> dict:
    """Run pneumonia classification."""
    with torch.no_grad():
        output = registry.pneumonia_model(img_tensor)
        probs = torch.softmax(output, dim=1)
        confidence, predicted = probs.max(1)

    pred_class = CLASS_NAMES[predicted.item()]
    conf = confidence.item() * 100
    normal_prob = probs[0][0].item() * 100
    pneumonia_prob = probs[0][1].item() * 100

    return {
        "classification": pred_class,
        "confidence": round(conf, 1),
        "probabilities": {
            "NORMAL": round(normal_prob, 1),
            "PNEUMONIA": round(pneumonia_prob, 1),
        },
    }


def generate_gradcam_base64(
    registry: ModelRegistry,
    img: Image.Image,
    img_tensor: torch.Tensor,
    target_class: int = None,
) -> dict:
    """Generate Grad-CAM heatmap and return as base64-encoded PNG."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.cm as cm

    try:
        # Need a fresh tensor with grad tracking for Grad-CAM
        cam_tensor = img_tensor.clone().detach().to(registry.device)
        cam = registry.gradcam.generate(cam_tensor, target_class=target_class)

        # Create overlay: original image + heatmap
        orig_resized = img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS)
        orig_array = np.array(orig_resized).astype(np.float32) / 255.0

        # Apply jet colormap to heatmap
        heatmap_colored = cm.jet(cam)[:, :, :3]  # Drop alpha

        # Blend: 55% original + 45% heatmap
        overlay = 0.55 * orig_array + 0.45 * heatmap_colored
        overlay = np.clip(overlay, 0, 1)

        # Convert to PNG bytes
        fig, ax = plt.subplots(1, 1, figsize=(3, 3), dpi=75)
        ax.imshow(overlay)
        ax.axis("off")
        fig.subplots_adjust(left=0, right=1, top=1, bottom=0)

        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0, dpi=150)
        plt.close(fig)
        buf.seek(0)

        image_base64 = base64.b64encode(buf.read()).decode("utf-8")

        return {"available": True, "image_base64": image_base64}

    except Exception as e:
        print(f"  [GradCAM] Error generating heatmap: {e}")
        return {"available": False, "image_base64": None}


def run_full_prediction(
    registry: ModelRegistry, file_bytes: bytes, include_gradcam: bool = True
) -> dict:
    """
    Full prediction pipeline: gatekeeper → pneumonia → Grad-CAM.
    Returns the complete response matching the frontend API contract.
    """
    start_time = time.time()
    transform = get_transform()

    # Load and preprocess image
    img = load_image(file_bytes)
    img_tensor = transform(img).unsqueeze(0).to(registry.device)

    # Step 1: Gatekeeper
    gatekeeper_result = run_gatekeeper(registry, img_tensor)

    if gatekeeper_result["result"] == "rejected":
        elapsed = int((time.time() - start_time) * 1000)
        return {
            "status": "rejected",
            "gatekeeper": gatekeeper_result,
            "prediction": None,
            "gradcam": None,
            "model": None,
            "message": "This image does not appear to be a frontal chest X-ray. "
            "Prediction has been skipped to prevent inaccurate results.",
            "processing_time_ms": elapsed,
        }

    # Step 2: Pneumonia prediction
    prediction_result = run_pneumonia_prediction(registry, img_tensor)

    # Step 3: Grad-CAM (optional)
    gradcam_result = {"available": False, "image_base64": None}
    if include_gradcam:
        target_cls = CLASS_NAMES.index(prediction_result["classification"])
        gradcam_result = generate_gradcam_base64(
            registry, img, img_tensor, target_class=target_cls
        )

    elapsed = int((time.time() - start_time) * 1000)

    return {
        "status": "success",
        "gatekeeper": gatekeeper_result,
        "prediction": prediction_result,
        "gradcam": gradcam_result,
        "model": {
            "name": "EfficientNet-B0",
            "input_size": f"{IMAGE_SIZE}x{IMAGE_SIZE}",
            "checkpoint": "best_model.pth",
        },
        "processing_time_ms": elapsed,
    }
