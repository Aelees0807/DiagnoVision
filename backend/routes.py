"""
DiagnoVision — API Routes
FastAPI route handlers for prediction, Grad-CAM, and health check.
Matches the frontend API contract in services/api.js.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from .config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB
from .models import (
    ModelRegistry,
    run_full_prediction,
    load_image,
    get_transform,
    generate_gradcam_base64,
    CLASS_NAMES,
)

router = APIRouter(prefix="/api")

# Registry will be injected by the app lifespan
_registry: ModelRegistry = None


def set_registry(registry: ModelRegistry):
    """Called by app.py to inject the loaded model registry."""
    global _registry
    _registry = registry


def _validate_file(file: UploadFile):
    """Validate uploaded file extension and content type."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )


# ── POST /api/predict ──────────────────────────────────────────
@router.post("/predict")
async def predict(
    image: UploadFile = File(...),
    include_gradcam: str = Form("true"),
):
    """
    Full prediction pipeline: gatekeeper → pneumonia → Grad-CAM.
    Accepts a chest X-ray image and returns classification + heatmap.
    """
    if not _registry or not _registry.is_loaded:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "error",
                "error_code": "MODEL_UNAVAILABLE",
                "message": "Models are still loading. Please try again in a moment.",
            },
        )

    _validate_file(image)

    # Read file bytes
    file_bytes = await image.read()

    # Check file size
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE_MB} MB.",
        )

    should_gradcam = include_gradcam.lower() in ("true", "1", "yes")

    try:
        result = run_full_prediction(_registry, file_bytes, include_gradcam=should_gradcam)
        return JSONResponse(content=result)

    except Exception as e:
        print(f"  [Predict] Error: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "error_code": "MODEL_ERROR",
                "message": "An error occurred during analysis. Please try again.",
            },
        )


# ── POST /api/gradcam ─────────────────────────────────────────
@router.post("/gradcam")
async def gradcam(
    image: UploadFile = File(...),
    target_class: str = Form(None),
):
    """Generate a Grad-CAM heatmap for the given image."""
    if not _registry or not _registry.is_loaded:
        raise HTTPException(status_code=503, detail="Models are still loading.")

    _validate_file(image)
    file_bytes = await image.read()

    try:
        img = load_image(file_bytes)
        transform = get_transform()
        img_tensor = transform(img).unsqueeze(0).to(_registry.device)

        tc = None
        if target_class is not None:
            tc = int(target_class)
            if tc not in (0, 1):
                raise ValueError("target_class must be 0 (NORMAL) or 1 (PNEUMONIA)")

        result = generate_gradcam_base64(_registry, img, img_tensor, target_class=tc)
        return JSONResponse(content=result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"  [GradCAM] Error: {e}")
        raise HTTPException(status_code=500, detail="Error generating Grad-CAM.")


# ── GET /api/health ────────────────────────────────────────────
@router.get("/health")
async def health():
    """Health check — reports model loading status."""
    import torch

    models_loaded = _registry is not None and _registry.is_loaded

    return JSONResponse(
        content={
            "status": "healthy" if models_loaded else "loading",
            "models_loaded": models_loaded,
            "device": str(_registry.device) if _registry else "unknown",
            "cuda_available": torch.cuda.is_available(),
            "models": {
                "pneumonia": {
                    "name": "EfficientNet-B0",
                    "loaded": _registry.pneumonia_model is not None if _registry else False,
                },
                "gatekeeper": {
                    "name": "MobileNetV3-Small",
                    "loaded": _registry.gatekeeper_model is not None if _registry else False,
                },
            },
        }
    )
