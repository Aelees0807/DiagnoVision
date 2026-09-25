"""
DiagnoVision — Deployment Configuration
Centralized constants for model paths, preprocessing, and thresholds.
(Standalone version for Hugging Face Spaces deployment)
"""

from pathlib import Path

# ── Project Paths ──────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent
CHECKPOINT_DIR = PROJECT_ROOT / "checkpoints"

PNEUMONIA_CHECKPOINT = CHECKPOINT_DIR / "best_model.pth"
GATEKEEPER_CHECKPOINT = CHECKPOINT_DIR / "gatekeeper_best.pth"

# ── Preprocessing ─────────────────────────────────────────────
IMAGE_SIZE = 224
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

# ── Classification ────────────────────────────────────────────
CLASS_NAMES = ["NORMAL", "PNEUMONIA"]
GATEKEEPER_CLASSES = ["chest_xray", "not_chest_xray"]
CONFIDENCE_THRESHOLD = 70.0  # percent

# ── Server ────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
MAX_FILE_SIZE_MB = 20
