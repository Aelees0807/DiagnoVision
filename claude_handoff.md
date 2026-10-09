# DiagnoVision - Comprehensive Developer Handoff

This document provides a complete technical overview of the **DiagnoVision** project from scratch. It is designed to get any AI assistant or developer up to speed on the architecture, models, performance, and recent optimizations.

---

## 1. Project Overview
**DiagnoVision** is an AI-assisted web application that screens pediatric frontal chest X-rays for signs consistent with pneumonia.
- **Goal:** Provide a fast, reliable, and accessible screening aid with high sensitivity.
- **Target Data:** Pediatric frontal chest X-rays (ages 1–5).
- **Deployment:** 
  - **Frontend:** React + Vite + TailwindCSS, hosted on Cloudflare Pages.
  - **Backend:** FastAPI + PyTorch Docker Container, hosted on Render Web Services (Free Tier).

---

## 2. Dataset & Data Pipeline
- **Source:** Kaggle's "Chest X-Ray Images (Pneumonia)" dataset (Guangzhou Women and Children's Medical Center).
- **Original Data Issues:** High class imbalance (74% Pneumonia), tiny validation set (only 16 images), and variable image sizes.
- **Our Resolution:** 
  - Stratified 85/15 re-split to create a robust 785-image validation set.
  - Implemented a custom PyTorch `DataLoader` pipeline that resizes images to `224x224`, normalizes using ImageNet standards, and applies data augmentations (random rotation, horizontal flip, resized crop) to prevent overfitting.
  - Handled class imbalance using **Class-Weighted CrossEntropyLoss** (NORMAL: 1.93, PNEUMONIA: 0.67).

---

## 3. The AI Models
DiagnoVision uses a two-stage sequential inference pipeline to prevent the tool from outputting medically invalid results on random images.

### Stage 1: The Gatekeeper (`MobileNetV3-Small`)
- **Purpose:** Answers *"Is this image actually a frontal chest X-ray?"*
- **Training:** Trained on a binary split of Chest X-Rays vs. Bone Fracture/Non-Chest images.
- **Behavior:** Runs first. If the image fails the gatekeeper check, the pneumonia screening is immediately aborted, preventing false positives on irrelevant uploads.

### Stage 2: The Pneumonia Classifier (`EfficientNet-B0`)
- **Purpose:** Answers *"Does this chest X-ray show signs of pneumonia?"*
- **Architecture:** Transfer learning from ImageNet-1K. The early feature layers (0-5) are frozen to retain edge/texture detection, while the deeper layers (6-8) and a custom dense classifier head are trained on the X-ray data.
- **Performance (Held-out Test Set of 624 images):**
  - **Overall Accuracy:** 89.10%
  - **Sensitivity (Recall):** 97.69% (Crucial for a screening tool—it almost never misses a sick patient).
  - **Negative Predictive Value (NPV):** 95.11% (A "Normal" result is highly trustworthy).
- **Safety Heuristic:** We instituted a strict **70% confidence threshold**. If the model predicts an outcome with less than 70% confidence, the UI returns an `[?] UNCERTAIN` state and advises professional review.

---

## 4. Backend Architecture (FastAPI)
- **Framework:** FastAPI running on Uvicorn.
- **Hardware:** Deployed on Render's free tier (0.5 vCPU, 512MB RAM). 
- **Inference Optimization:** Because the free tier is extremely resource-constrained, the backend avoids heavy memory allocations. We run model inference in `torch.no_grad()` mode and aggressively delete tensors post-inference to prevent `OOM (Out of Memory)` crashes.

---

## 5. Frontend Architecture (React)
- **Framework:** React 18, bundled with Vite.
- **Styling:** TailwindCSS with custom "glassmorphism" UI components and fluid animations.
- **State Management:** Custom React hooks (`usePrediction`, `useClientGradCAM`) to manage asynchronous API calls, file uploads, object URLs, and WebAssembly model states.

---

## 6. The WebAssembly Grad-CAM Migration (Latest Optimization)
Grad-CAM (Gradient-weighted Class Activation Mapping) is used to generate a heat map over the X-ray, visually explaining which regions of the lungs the AI focused on.

**The Problem:** Generating Grad-CAM on the PyTorch backend required retaining feature maps and running complex tensor math, which caused memory spikes >500MB, instantly crashing the Render free-tier server with `OOM`.

**The Solution:** We migrated Grad-CAM generation entirely to the client's browser!
1. **ONNX Export:** We exported the PyTorch `EfficientNet-B0` model to a self-contained 19MB `.onnx` file using `torch.jit.trace`, specifically exposing both the final logits and the final convolutional feature maps `[1, 1280, 7, 7]`.
2. **WASM Integration:** We integrated `onnxruntime-web` into the Vite frontend, allowing the browser to download the 19MB model in the background.
3. **Client-Side Inference:** The React app uses `fetch` and `createImageBitmap` to convert the user's uploaded image into a normalized `Float32Array` tensor, feeds it to the ONNX model locally, and uses a mathematical approximation (Feature-Map Activation/GAP-CAM) to generate the heatmap.
4. **Result:** The backend is now completely freed from heatmap generation, saving ~150MB of server RAM per request. The visual explanation is now calculated on the user's GPU/CPU in the browser in milliseconds!

---

## 7. Current Project Status
- **Complete & Stable.** The dual-model pipeline is accurate, the UI is polished, and the cloud deployment is strictly optimized to run flawlessly within extreme memory constraints.
- **Next Steps (If any):** Future iterations could involve training on larger, multi-hospital datasets, supporting lateral view X-rays, or expanding to multi-class pulmonary conditions.
