"""
DiagnoVision — FastAPI Application (Deployment Version)
Standalone version for Hugging Face Spaces.

Runs on port 7860 (HF Spaces default).
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import ModelRegistry
from routes import router, set_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models at startup, clean up at shutdown."""
    print()
    print("=" * 60)
    print("  DiagnoVision — Backend Starting (HF Spaces)")
    print("=" * 60)
    print()

    registry = ModelRegistry()
    registry.load_all()
    set_registry(registry)

    print()
    print("  Server ready! Accepting requests.")
    print("=" * 60)
    print()

    yield

    print("  Shutting down DiagnoVision backend...")


app = FastAPI(
    title="DiagnoVision API",
    description="AI-Assisted Pneumonia Screening from Pediatric Chest X-Rays",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS — allow Cloudflare Pages frontend ─────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # UPDATE THESE with your actual deployed URLs:
        "https://diagnovision.pages.dev",
        "https://*.diagnovision.pages.dev",
        # Local development
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {
        "name": "DiagnoVision API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "predict": "POST /api/predict",
            "gradcam": "POST /api/gradcam",
            "health": "GET /api/health",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860)
