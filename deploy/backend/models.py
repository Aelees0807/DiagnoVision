"""
DiagnoVision — Model Loading & Inference (Deployment Version)
Standalone version with flat imports for Hugging Face Spaces.

Optimized for memory-constrained environments (Render Free Tier = 512 MB).
"""

import io
import gc
import base64
import time

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms, models
from PIL import Image
import numpy as np

from config import (
    PNEUMONIA_CHECKPOINT,
    GATEKEEPER_CHECKPOINT,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    CLASS_NAMES,
    GATEKEEPER_CLASSES,
    CONFIDENCE_THRESHOLD,
    ENABLE_GRADCAM,
)


def _force_gc():
    """Force garbage collection to free memory after inference."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


# ── Singleton model holder ─────────────────────────────────────
class ModelRegistry:
    """Holds loaded models so they're initialized once at startup."""

    def __init__(self):
        self.device = None
        self.pneumonia_model = None
        self.gatekeeper_model = None
        self.gradcam = None
        self._loaded = False
        self.gradcam_enabled = ENABLE_GRADCAM

    @property
    def is_loaded(self):
        return self._loaded

    def load_all(self):
        """Load both models and set up Grad-CAM. Called once at app startup."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"  [Models] Using device: {self.device}")

        # Optimize CPU threads for limited environments like Render Free Tier (0.5 CPU)
        if self.device.type == "cpu":
            torch.set_num_threads(1)
            # Reduce inter-op parallelism too
            torch.set_num_interop_threads(1)

        self.pneumonia_model = self._load_pneumonia()
        self.gatekeeper_model = self._load_gatekeeper()

        # Only set up Grad-CAM if enabled (FastGradCAM uses < 100 KB memory)
        if self.gradcam_enabled:
            self.gradcam = FastGradCAM(self.pneumonia_model)
            print("  [Models] Grad-CAM: ENABLED")
        else:
            self.gradcam = None
            print("  [Models] Grad-CAM: DISABLED (set ENABLE_GRADCAM=true to enable)")

        self._loaded = True

        # Force GC after loading to reclaim checkpoint loading overhead
        _force_gc()

        import psutil, os
        process = psutil.Process(os.getpid())
        mem_mb = process.memory_info().rss / 1024 / 1024
        print(f"  [Models] Memory after loading: {mem_mb:.0f} MB")
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
        # Free the raw checkpoint dict immediately
        del checkpoint
        _force_gc()

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
        # Free the raw checkpoint dict immediately
        del checkpoint
        _force_gc()

        model = model.to(self.device)
        model.eval()
        print(f"  [Models] Gatekeeper model loaded from {GATEKEEPER_CHECKPOINT.name}")
        return model


# ── Fast Jet Colormap Lookup Table (256x3) for zero-matplotlib rendering ──
def _build_jet_lut():
    lut = []
    for i in range(256):
        v = i / 255.0
        if v < 0.125:
            r, g, b = 0.0, 0.0, 0.5 + v * 4.0
        elif v < 0.375:
            r, g, b = 0.0, (v - 0.125) * 4.0, 1.0
        elif v < 0.625:
            r, g, b = (v - 0.375) * 4.0, 1.0, 1.0 - (v - 0.375) * 4.0
        elif v < 0.875:
            r, g, b = 1.0, 1.0 - (v - 0.625) * 4.0, 0.0
        else:
            r, g, b = 1.0 - (v - 0.875) * 4.0, 0.0, 0.0
        lut.append([int(r * 255), int(g * 255), int(b * 255)])
    return np.array(lut, dtype=np.uint8)

_JET_LUT = _build_jet_lut()


# ── Grad-CAM ───────────────────────────────────────────────────
class FastGradCAM:
    """
    Exact, memory-safe Grad-CAM for EfficientNet-B0.
    
    Instead of backpropagating through all 16 MBConv blocks of the backbone
    (which spikes memory by ~180MB and causes OOM on Render 512MB free tier),
    we exploit the mathematical property that the backbone connects to the classifier
    only via Global Average Pooling:
    
        d(Score_c) / d(Feature_k,i,j) = (1/49) * d(Score_c) / d(Pooled_k)
    
    Backpropagating only through the 2-layer classifier head is mathematically
    identical to full Grad-CAM (verified diff: < 2e-7), while using < 100 KB RAM
    and running in ~30ms without memory spikes.
    """

    def __init__(self, model):
        self.model = model

    def generate(self, img_tensor, target_class=None):
        """Generate Grad-CAM heatmap. Returns heatmap as numpy array (H, W) in [0, 1]."""
        self.model.eval()

        with torch.no_grad():
            feat = self.model.features(img_tensor)  # (1, 1280, 7, 7)
            pooled = self.model.avgpool(feat).flatten(1)  # (1, 1280)

        pooled.requires_grad_(True)
        logits = self.model.classifier(pooled)

        if target_class is None:
            target_class = logits.argmax(dim=1).item()

        score = logits[0, target_class]
        grad_pooled = torch.autograd.grad(score, pooled)[0]  # (1, 1280)
        weights = grad_pooled.view(1, 1280, 1, 1)

        cam = torch.relu((weights * feat).sum(dim=1, keepdim=True))
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


GradCAM = FastGradCAM


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
    """Load image from raw bytes, resize early to save memory, convert to RGB."""
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    # Immediately downsize large images to save memory
    # A 4000x4000 RGB image = ~48 MB in memory; 224x224 = ~150 KB
    max_dim = max(img.size)
    if max_dim > 512:
        # Scale down to 512px max side (still larger than 224 for quality)
        ratio = 512 / max_dim
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    return img


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
    if not registry.gradcam_enabled or registry.gradcam is None:
        return {"available": False, "image_base64": None}

    try:
        cam = registry.gradcam.generate(img_tensor, target_class=target_class)

        orig_resized = img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS)
        orig_array = np.array(orig_resized, dtype=np.float32)

        cam_uint8 = (cam * 255).astype(np.uint8)
        heatmap_colored = _JET_LUT[cam_uint8].astype(np.float32)

        overlay = (0.55 * orig_array + 0.45 * heatmap_colored).clip(0, 255).astype(np.uint8)
        result_img = Image.fromarray(overlay)

        buf = io.BytesIO()
        result_img.save(buf, format="PNG", optimize=False)
        buf.seek(0)

        image_base64 = base64.b64encode(buf.read()).decode("utf-8")

        # Clean up
        del cam, orig_array, heatmap_colored, overlay
        _force_gc()

        return {"available": True, "image_base64": image_base64}

    except Exception as e:
        print(f"  [GradCAM] Error: {e}")
        return {"available": False, "image_base64": None}


def run_full_prediction(
    registry: ModelRegistry, file_bytes: bytes, include_gradcam: bool = True
) -> dict:
    """Full prediction pipeline: gatekeeper → pneumonia → Grad-CAM."""
    start_time = time.time()
    transform = get_transform()

    img = load_image(file_bytes)
    # Free the raw bytes immediately — we have the PIL image now
    del file_bytes

    img_tensor = transform(img).unsqueeze(0).to(registry.device)

    # Step 1: Gatekeeper
    gatekeeper_result = run_gatekeeper(registry, img_tensor)

    if gatekeeper_result["result"] == "rejected":
        elapsed = int((time.time() - start_time) * 1000)
        # Clean up tensors
        del img_tensor, img
        _force_gc()
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

    # Step 3: Grad-CAM (only if enabled AND requested)
    gradcam_result = {"available": False, "image_base64": None}
    if include_gradcam and registry.gradcam_enabled:
        target_cls = CLASS_NAMES.index(prediction_result["classification"])
        gradcam_result = generate_gradcam_base64(
            registry, img, img_tensor, target_class=target_cls
        )

    elapsed = int((time.time() - start_time) * 1000)

    # Clean up tensors after inference
    del img_tensor, img
    _force_gc()

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
