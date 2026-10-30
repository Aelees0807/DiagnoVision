# Render Memory Limit Bugfix Design

## Overview

This bugfix resolves the architectural mismatch between the documented client-side ONNX Grad-CAM implementation and the actual backend behavior that generates Grad-CAM server-side by default. The backend's `/api/predict` endpoint defaults to `include_gradcam="true"`, triggering PyTorch-based server-side generation via the `FastGradCAM` class, which consumes ~150MB RAM per request and causes Render's free tier (512MB) to exceed memory limits under concurrent load.

The fix implements backward-compatible changes to the backend API: change the default value of `include_gradcam` from "true" to "false", ensuring the server does not generate Grad-CAM by default while maintaining the frontend's ability to explicitly request it and preserving the `/api/gradcam` endpoint as a fallback option.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the `/api/predict` endpoint is called with default parameters (no explicit `include_gradcam` value)
- **Property (P)**: The desired behavior - the backend SHALL NOT generate Grad-CAM server-side by default, staying within memory limits
- **Preservation**: Existing prediction accuracy, gatekeeper functionality, API response structure, and explicit Grad-CAM generation (via parameter or `/api/gradcam` endpoint) that must remain unchanged
- **FastGradCAM**: The PyTorch-based Grad-CAM implementation in `backend/models.py` that performs gradient computation on the server
- **include_gradcam**: Form parameter in `/api/predict` that controls server-side Grad-CAM generation
- **run_full_prediction**: The function in `backend/models.py` that orchestrates the full prediction pipeline including optional Grad-CAM generation

## Bug Details

### Bug Condition

The bug manifests when the `/api/predict` endpoint receives a request without an explicit `include_gradcam` parameter value, or when the frontend explicitly passes `include_gradcam="true"`. The FastAPI route handler has a default value of `Form("true")`, which means the backend generates Grad-CAM server-side by default, triggering PyTorch gradient computation that allocates ~150MB RAM per request.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type PredictRequest
  OUTPUT: boolean
  
  RETURN request.endpoint == "/api/predict"
         AND (request.include_gradcam IS NULL OR request.include_gradcam IN ["true", "1", "yes"])
         AND concurrentRequests >= 1
         AND serverMemoryUsage + 150MB > 512MB
END FUNCTION
```

### Examples

- **Example 1**: User uploads chest X-ray via frontend → frontend calls `predictImage(file, true)` → backend receives `include_gradcam="true"` → FastGradCAM generates heatmap server-side → memory usage spikes by ~150MB → under concurrent load (3-4 users), total RAM exceeds 512MB → Render restarts the process
- **Example 2**: User uploads chest X-ray → backend receives request with default `include_gradcam` (no explicit value) → FastAPI uses default `Form("true")` → same memory spike occurs
- **Example 3**: Single user uploads image during cold start → backend already uses ~200MB for model loading → Grad-CAM generation adds 150MB → approaches 350MB (safe) → but second concurrent request would exceed limit
- **Edge Case**: User calls `/api/gradcam` endpoint directly → server-side generation is expected and correct behavior (should continue to work)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pneumonia classification accuracy and confidence scores must remain identical
- Gatekeeper rejection of non-chest X-ray images must continue to work exactly as before
- API response structure (JSON fields, status codes, error messages) must remain unchanged
- `/api/gradcam` endpoint must continue to generate Grad-CAM server-side when called explicitly
- When `include_gradcam` is explicitly set to "true" via the API, server-side generation must continue to work (backward compatibility)
- Model loading, device selection, and inference behavior must remain unchanged
- Health check endpoint (`/api/health`) must continue to report correct status

**Scope:**
All prediction requests that previously worked correctly (classification, gatekeeper checks, error handling) should be completely unaffected by this fix. This includes:
- Classification predictions with or without Grad-CAM
- Gatekeeper-rejected requests
- Error responses for invalid images or file types
- Processing time metrics in the response

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Incorrect Default Parameter Value**: The `/api/predict` route handler defines `include_gradcam: str = Form("true")`, making server-side Grad-CAM generation the default behavior despite the README documenting client-side ONNX as the primary method.

2. **Frontend-Backend Mismatch**: The frontend's `usePrediction.js` hook explicitly passes `includeGradcam = true` in the API call (line 48: `await predictImage(file, true, {...})`), with a comment claiming "we disable it on the backend to save ~150 MB RAM" that does not match the actual parameter value being sent.

3. **Unintentional Backend Activation**: The combination of the backend's default value and the frontend's explicit "true" parameter means Grad-CAM is generated server-side on every prediction request, despite the architecture documentation stating it should happen client-side.

4. **Memory Accumulation Under Load**: While a single Grad-CAM generation (~150MB) is manageable, concurrent requests or multiple sequential requests without garbage collection cause memory to accumulate beyond Render's 512MB limit, triggering automatic restarts.

## Correctness Properties

Property 1: Bug Condition - Default Grad-CAM Disabled

_For any_ prediction request to `/api/predict` where `include_gradcam` is not explicitly provided or is set to "false", the backend SHALL NOT perform server-side Grad-CAM generation, SHALL return `gradcam: {available: false, image_base64: null}` in the response, and SHALL complete the request using only the memory required for model inference (~200MB baseline), staying safely within Render's 512MB memory limit even under concurrent load.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Prediction Accuracy and API Contract

_For any_ valid chest X-ray image submitted to `/api/predict`, the fixed backend SHALL produce identical classification results (predicted class, confidence scores, probabilities) as the original implementation, SHALL maintain the exact same JSON response structure with all required fields (status, gatekeeper, prediction, gradcam, model, processing_time_ms), and SHALL preserve all existing error handling and gatekeeper rejection behavior.

**Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6**

Property 3: Preservation - Explicit Grad-CAM Generation

_For any_ request where `include_gradcam` is explicitly set to "true" (via `/api/predict` parameter) OR when using the dedicated `/api/gradcam` endpoint, the backend SHALL continue to generate Grad-CAM heatmaps server-side using the FastGradCAM implementation, SHALL return valid base64-encoded PNG images in the response, preserving backward compatibility for clients that rely on server-side generation.

**Validates: Requirements 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/routes.py`

**Function**: `predict` route handler (line 38)

**Specific Changes**:
1. **Change Default Parameter**: Modify the `include_gradcam` parameter default from `Form("true")` to `Form("false")`
   - Line 38: `include_gradcam: str = Form("true"),` → `include_gradcam: str = Form("false"),`
   - This ensures the backend does not generate Grad-CAM by default unless explicitly requested

2. **Verify Parameter Parsing**: Ensure the existing boolean conversion logic (`should_gradcam = include_gradcam.lower() in ("true", "1", "yes")`) correctly handles the new default
   - No changes needed - existing logic at line 57 already handles "false" correctly

3. **Update Comments**: Add clarifying comments explaining the default behavior
   - Add comment above the parameter: `# Default "false" - client-side ONNX handles Grad-CAM visualization`
   - Add comment explaining backward compatibility: `# Explicit "true" supported for backward compatibility and debugging`

**File**: `frontend/src/hooks/usePrediction.js`

**Function**: `submitPrediction` callback (line 48)

**Specific Changes**:
4. **Fix Frontend Parameter**: Change the hardcoded `true` parameter to `false` to align with client-side ONNX architecture
   - Line 48: `const response = await predictImage(file, true, {` → `const response = await predictImage(file, false, {`
   - This ensures the frontend requests match the documented client-side approach

5. **Update Misleading Comment**: Correct the comment that claims to disable Grad-CAM while actually enabling it
   - Line 47-48: Update comment to accurately reflect the parameter value
   - New comment: `// Grad-CAM is generated client-side via ONNX Runtime Web (see clientGradCAM.js),`
   - `// so we disable server-side generation to save ~150 MB RAM on Render's free tier.`

**File**: `backend/models.py`

**Function**: No code changes required, only documentation

**Specific Changes**:
6. **Add Documentation**: Add docstring clarification to `run_full_prediction` explaining the `include_gradcam` parameter default behavior
   - Add parameter documentation: `include_gradcam: bool = False — Generate Grad-CAM server-side (legacy/fallback)`
   - Add note: "Client-side ONNX generation is recommended for production to avoid memory pressure"

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the memory issue on unfixed code with concurrent requests, then verify the fix resolves memory usage while preserving all existing functionality.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the memory bug BEFORE implementing the fix. Confirm that concurrent requests with default Grad-CAM enabled cause memory to exceed 512MB on Render. If we cannot reproduce locally (due to higher RAM availability), validate via Render deployment logs.

**Test Plan**: Deploy the unfixed backend to Render free tier and simulate concurrent prediction requests with monitoring. Observe memory metrics via Render dashboard and look for OOM restarts. Run memory profiling locally using `tracemalloc` to measure peak allocation during Grad-CAM generation.

**Test Cases**:
1. **Single Request Memory Test**: Send one prediction with `include_gradcam="true"`, measure peak memory delta (expect ~150MB increase) (will demonstrate memory spike on unfixed code)
2. **Concurrent Load Test**: Send 3-4 simultaneous predictions with default parameters, monitor total backend RAM (expect to exceed 512MB, trigger restart) (will fail on unfixed code)
3. **Sequential Request Test**: Send 10 sequential predictions rapidly, check if memory accumulates without garbage collection (may fail on unfixed code)
4. **Render Deployment Test**: Deploy unfixed code to Render, trigger real user traffic pattern, observe Render logs for OOM restarts (will show actual production failure)

**Expected Counterexamples**:
- Memory usage spikes by ~150MB per Grad-CAM generation
- Concurrent requests accumulate memory beyond 512MB
- Render logs show process restart with exit code 137 (OOM killed)
- Possible causes: default `Form("true")` parameter, frontend passing explicit "true", FastGradCAM gradient computation

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (default parameters, no explicit Grad-CAM request), the fixed backend does NOT generate Grad-CAM server-side and stays within memory limits.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := predict_fixed(request)
  ASSERT response.gradcam.available == False
  ASSERT response.gradcam.image_base64 == None
  ASSERT peakMemoryUsage < 300MB  # Well under 512MB limit
  ASSERT response.status == "success"  # Prediction still works
  ASSERT response.prediction is not None  # Classification unaffected
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (explicit Grad-CAM requested via parameter or `/api/gradcam` endpoint), the fixed backend produces the same Grad-CAM results as the original function.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) AND request.include_gradcam == "true" DO
  ASSERT predict_original(request).gradcam.image_base64 == predict_fixed(request).gradcam.image_base64
  ASSERT predict_original(request).prediction == predict_fixed(request).prediction
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (different image types, sizes, content)
- It catches edge cases that manual unit tests might miss (corrupted images, boundary values, concurrent requests)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs (classification accuracy preserved)

**Test Plan**: Observe behavior on UNFIXED code first for explicit Grad-CAM requests (both via `/api/predict` with `include_gradcam="true"` and via `/api/gradcam` endpoint), capture baseline results, then write property-based tests to verify the FIXED code produces identical outputs.

**Test Cases**:
1. **Explicit Grad-CAM via Parameter**: Send request to `/api/predict` with `include_gradcam="true"`, verify FIXED backend generates identical heatmap as UNFIXED (base64 comparison with tolerance for floating-point differences)
2. **Dedicated Grad-CAM Endpoint**: Send request to `/api/gradcam`, verify FIXED backend continues to work exactly as before (endpoint should be unaffected by the fix)
3. **Classification Accuracy Preservation**: Run predictions on 100 test images with FIXED code, compare classification results to UNFIXED baseline, verify 100% match on predicted class and confidence scores
4. **Gatekeeper Preservation**: Test gatekeeper rejection on non-chest X-ray images, verify FIXED code rejects at the same rate as UNFIXED code
5. **API Contract Preservation**: Parse JSON responses from FIXED backend, validate all required fields are present with correct types (status, gatekeeper, prediction, gradcam, model, processing_time_ms)
6. **Error Handling Preservation**: Test error scenarios (oversized file, invalid format, corrupted image), verify FIXED backend returns same HTTP status codes and error messages as UNFIXED code

### Unit Tests

- Test default parameter behavior: verify `/api/predict` without `include_gradcam` parameter defaults to "false"
- Test explicit "true" parameter: verify `/api/predict` with `include_gradcam="true"` still generates Grad-CAM
- Test explicit "false" parameter: verify `/api/predict` with `include_gradcam="false"` skips Grad-CAM
- Test `/api/gradcam` endpoint: verify it continues to generate Grad-CAM regardless of default parameter changes
- Test response structure: verify `gradcam.available` field correctly reflects generation status
- Test memory footprint: verify prediction without Grad-CAM uses <300MB peak memory

### Property-Based Tests

- Generate random valid chest X-ray images and verify classification results are identical between UNFIXED and FIXED code (with `include_gradcam="false"`)
- Generate random `include_gradcam` parameter values (true/false/1/0/yes/no) and verify boolean parsing logic works correctly
- Generate random image sizes and formats to verify gatekeeper and prediction accuracy are preserved
- Test concurrent request patterns (1-10 simultaneous requests) to verify FIXED code stays within memory limits under all load conditions

### Integration Tests

- Full workflow test: Upload image via frontend → verify frontend sends `include_gradcam="false"` → verify backend returns prediction without Grad-CAM → verify frontend uses client-side ONNX for visualization
- Backward compatibility test: External client explicitly requests server-side Grad-CAM via `/api/predict` with `include_gradcam="true"` → verify it still works
- Deployment test: Deploy FIXED code to Render staging environment → run load test with 5 concurrent users → monitor Render metrics for memory usage and process stability → verify no restarts occur
- End-to-end test: User uploads 10 images sequentially via production frontend → verify all predictions succeed without backend restarts → verify Grad-CAM visualizations appear correctly (generated client-side)
