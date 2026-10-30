# Bugfix Requirements Document

## Introduction

The DiagnoVision backend deployed on Render Web Services (free tier with 512MB RAM) is exceeding its memory limit and experiencing automatic restarts. The issue began after recent Grad-CAM heatmap generation changes were deployed. 

The README states that "Grad-CAM heatmap generation has been migrated completely to the browser using ONNX Runtime Web (WebAssembly)" to bypass backend RAM limits and save ~150MB per request. However, the backend code still performs server-side PyTorch Grad-CAM generation by default in the `/api/predict` endpoint (`include_gradcam: str = Form("true")`), causing memory exhaustion under load.

This bugfix addresses the architectural mismatch between the intended client-side ONNX approach and the current server-side PyTorch implementation that triggers memory limit violations.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the `/api/predict` endpoint receives a request with `include_gradcam="true"` (the default) THEN the system generates Grad-CAM server-side using PyTorch (`FastGradCAM` class in `models.py`)

1.2 WHEN multiple prediction requests arrive concurrently with Grad-CAM enabled THEN the system accumulates PyTorch tensors and gradient computations in memory

1.3 WHEN backend memory usage exceeds Render's free tier limit (512MB) THEN the system is automatically restarted by Render's process manager

1.4 WHEN the system is restarted during active user sessions THEN the service becomes temporarily unavailable with failed requests

1.5 WHEN Grad-CAM is generated server-side THEN the system uses ~150MB additional RAM per request despite the README claiming client-side generation

### Expected Behavior (Correct)

2.1 WHEN the `/api/predict` endpoint receives a request THEN the system SHALL NOT generate Grad-CAM server-side by default

2.2 WHEN prediction requests arrive (with or without concurrent load) THEN the system SHALL remain within Render's free tier memory limits (512MB)

2.3 WHEN under normal prediction load THEN the system SHALL NOT be automatically restarted by Render

2.4 WHEN users request predictions THEN the system SHALL maintain service availability without memory-related interruptions

2.5 WHEN Grad-CAM visualization is needed THEN the client-side ONNX implementation SHALL be the primary generation method (as documented in README)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the `/api/predict` endpoint receives a valid chest X-ray image THEN the system SHALL CONTINUE TO return correct pneumonia classification results with confidence scores

3.2 WHEN the gatekeeper check is performed THEN the system SHALL CONTINUE TO reject non-chest X-ray images correctly

3.3 WHEN the `/api/gradcam` endpoint is called explicitly THEN the system SHALL CONTINUE TO generate Grad-CAM heatmaps server-side (as a legacy/fallback option)

3.4 WHEN prediction accuracy and model inference are performed THEN the system SHALL CONTINUE TO produce identical classification results

3.5 WHEN the frontend expects the prediction response format THEN the system SHALL CONTINUE TO return responses matching the existing API contract structure

3.6 WHEN the health check endpoint (`/api/health`) is called THEN the system SHALL CONTINUE TO report model loading status correctly
