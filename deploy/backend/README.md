# DiagnoVision — Backend Deployment (Hugging Face Spaces)

This folder contains the **deployment-ready** backend for Hugging Face Spaces.

## Files
- `Dockerfile` — Container config for HF Spaces (Docker SDK)
- `app.py` — FastAPI server entry point (port 7860)
- `config.py` — Model paths and constants
- `models.py` — Model loading, inference, Grad-CAM
- `routes.py` — API endpoints
- `requirements.txt` — Python dependencies (CPU-only PyTorch)

## Setup

1. Create a new HF Space: https://huggingface.co/new-space
   - SDK: **Docker**
   - Hardware: **CPU basic** (free)

2. Clone your Space:
   ```bash
   git clone https://huggingface.co/spaces/YOUR_USERNAME/diagnovision-api
   cd diagnovision-api
   ```

3. Copy these files + model checkpoints:
   ```bash
   cp deploy/backend/* .
   mkdir checkpoints
   cp D:\DiagnoVision\checkpoints\best_model.pth checkpoints/
   cp D:\DiagnoVision\checkpoints\gatekeeper_best.pth checkpoints/
   ```

4. Set up Git LFS for model files:
   ```bash
   git lfs install
   git lfs track "*.pth"
   ```

5. Push:
   ```bash
   git add .
   git commit -m "Deploy DiagnoVision API"
   git push
   ```

6. Update CORS origins in `app.py` with your Cloudflare Pages URL.

## After Deployment

Your API will be live at:
```
https://YOUR_USERNAME-diagnovision-api.hf.space/api/health
```
