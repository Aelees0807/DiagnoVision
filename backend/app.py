"""
DiagnoVision — FastAPI Application
Main entry point: starts the server, loads models on startup,
configures CORS for frontend communication.

Usage:
    C:\\anaconda\\python.exe -m uvicorn backend.app:app --reload --port 8000
    
    Or from the project root:
    C:\\anaconda\\python.exe backend/app.py
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import ModelRegistry
from .routes import router, set_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models at startup, clean up at shutdown."""
    print()
    print("=" * 60)
    print("  DiagnoVision — Backend Starting")
    print("=" * 60)
    print()

    registry = ModelRegistry()
    registry.load_all()
    set_registry(registry)

    print()
    print("  Server ready! Accepting requests.")
    print("=" * 60)
    print()

    yield  # App is running

    # Cleanup on shutdown
    print("  Shutting down DiagnoVision backend...")


app = FastAPI(
    title="DiagnoVision API",
    description="AI-Assisted Pneumonia Screening from Pediatric Chest X-Rays",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS — allow frontend dev server ───────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount routes ───────────────────────────────────────────────
app.include_router(router)


# ── Root redirect ──────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": "DiagnoVision API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "predict": "POST /api/predict",
            "gradcam": "POST /api/gradcam",
            "health": "GET /api/health",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
