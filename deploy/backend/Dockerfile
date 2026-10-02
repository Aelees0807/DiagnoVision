FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY config.py .
COPY models.py .
COPY routes.py .

# Copy model checkpoints
COPY checkpoints/ checkpoints/

# ── Memory Optimization for Render Free Tier (512 MB) ──────────
# Disable Grad-CAM by default to save ~150 MB of peak memory.
# Set ENABLE_GRADCAM=true if you upgrade to a plan with >= 1 GB RAM.
ENV ENABLE_GRADCAM=false

# Limit Python's memory allocator fragmentation
ENV MALLOC_TRIM_THRESHOLD_=65536
ENV PYTHONMALLOC=malloc
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Expose HF Spaces default port
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/api/health')" || exit 1

# Start server with timeout increased for slow CPU inference
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--timeout-keep-alive", "120"]
