# Implementation Plan

## Overview

This task list implements the render-memory-limit-fix bugfix following the exploratory bugfix workflow:
1. **Explore** - Write property-based tests BEFORE fix to understand the bug (Bug Condition)
2. **Preserve** - Write property-based tests for non-buggy behavior (Preservation Requirements)
3. **Implement** - Apply the fix with understanding (Expected Behavior)
4. **Validate** - Verify fix works and doesn't break anything

## Tasks

- [ ] 1. Write bug condition exploration test (BEFORE implementing fix)
  - **Property 1: Bug Condition** - Server-side Grad-CAM Default Memory Spike
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the memory bug exists
  - **Scoped PBT Approach**: Test default parameter behavior and concurrent request memory accumulation
  - Set up pytest with hypothesis for property-based testing
  - Add pytest and hypothesis to backend/requirements.txt
  - Create backend/tests/__init__.py
  - Create backend/tests/conftest.py with fixtures for test image loading
  - Create backend/tests/test_bug_condition.py with property-based test:
    - Property: For all prediction requests with default parameters (include_gradcam not explicitly set OR include_gradcam="true"), server-side Grad-CAM generation is triggered
    - Test implementation: Call /api/predict without include_gradcam parameter, assert gradcam.available == True in response (on unfixed code)
    - Memory tracking: Use tracemalloc to measure peak memory delta during Grad-CAM generation
    - Concurrent load test: Simulate 3-4 simultaneous requests, measure total memory usage
    - Expected behavior: Memory spike of ~150MB per request when Grad-CAM is generated
  - Run test on UNFIXED code using: `pytest backend/tests/test_bug_condition.py -v`
  - **EXPECTED OUTCOME**: Test FAILS because default behavior generates Grad-CAM server-side, causing memory spike
  - Document counterexamples found (e.g., "default request triggers FastGradCAM.generate(), memory increases by 150MB")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (explicit Grad-CAM requests and /api/gradcam endpoint)
  - Create backend/tests/test_preservation.py with property-based tests:
    - Property 2.1: Classification Accuracy Preservation
      - For all valid chest X-ray images, classification results (predicted class, confidence scores) must be identical
      - Observe: Run predictions on sample test images from chest_xray/test/, record baseline results
      - Write property-based test: Generate various test images, verify classification matches baseline
    - Property 2.2: Gatekeeper Functionality Preservation
      - For all non-chest X-ray images, gatekeeper rejection behavior must be identical
      - Observe: Test gatekeeper on bone fracture images, record rejection rates
      - Write property-based test: Verify gatekeeper still rejects non-chest X-rays correctly
    - Property 2.3: API Response Structure Preservation
      - For all prediction requests, JSON response structure must remain unchanged
      - Observe: Parse response from unfixed code, verify all fields present (status, gatekeeper, prediction, gradcam, model, processing_time_ms)
      - Write property-based test: Validate response schema matches API contract
    - Property 2.4: Explicit Grad-CAM Generation Preservation
      - For all requests with explicit include_gradcam="true", server-side generation must continue to work
      - Observe: Call /api/predict with include_gradcam="true", verify gradcam.image_base64 is returned
      - Write property-based test: Verify explicit "true" parameter still generates Grad-CAM
    - Property 2.5: Dedicated Grad-CAM Endpoint Preservation
      - For all requests to /api/gradcam, server-side generation must continue to work
      - Observe: Call /api/gradcam endpoint directly, verify heatmap is generated
      - Write property-based test: Verify /api/gradcam endpoint unaffected by default parameter changes
  - Run tests on UNFIXED code using: `pytest backend/tests/test_preservation.py -v`
  - **EXPECTED OUTCOME**: All tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix for server-side Grad-CAM default parameter causing memory exhaustion

  - [ ] 3.1 Change backend default parameter from "true" to "false"
    - Modify backend/routes.py line 38:
      - Change `include_gradcam: str = Form("true"),` to `include_gradcam: str = Form("false"),`
    - Add clarifying comment above the parameter explaining the default behavior:
      - `# Default "false" - client-side ONNX handles Grad-CAM visualization`
      - `# Reduces server memory usage from ~350MB to ~200MB (critical for Render 512MB free tier)`
    - Add comment explaining backward compatibility:
      - `# Explicit "true" supported for backward compatibility and debugging`
    - Verify existing boolean conversion logic (line 57) correctly handles new default
      - Confirm `should_gradcam = include_gradcam.lower() in ("true", "1", "yes")` handles "false" correctly
    - _Bug_Condition: isBugCondition(request) where request.endpoint == "/api/predict" AND (request.include_gradcam IS NULL OR request.include_gradcam IN ["true", "1", "yes"])_
    - _Expected_Behavior: Backend SHALL NOT generate Grad-CAM server-side by default, SHALL return gradcam.available == False_
    - _Preservation: Explicit "true" parameter and /api/gradcam endpoint must continue to generate server-side Grad-CAM_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3_

  - [ ] 3.2 Fix frontend parameter to align with client-side ONNX architecture
    - Locate frontend/src/hooks/usePrediction.js (or equivalent API service file)
    - Find the predictImage call (approximately line 48 based on root cause analysis)
    - Change hardcoded parameter: `await predictImage(file, true, {` → `await predictImage(file, false, {`
    - Update misleading comment to accurately reflect the parameter value:
      - Old: Comment claims to disable Grad-CAM while passing "true"
      - New: `// Grad-CAM is generated client-side via ONNX Runtime Web (see clientGradCAM.js),`
      - `// so we disable server-side generation to save ~150 MB RAM on Render's free tier.`
    - Verify client-side ONNX implementation exists and is functional (check for clientGradCAM.js or similar)
    - _Bug_Condition: Frontend explicitly passes include_gradcam="true", contradicting documented client-side approach_
    - _Expected_Behavior: Frontend SHALL pass include_gradcam="false" to leverage client-side ONNX_
    - _Preservation: API call structure and response handling must remain unchanged_
    - _Requirements: 2.1, 2.5_

  - [ ] 3.3 Add documentation to backend/models.py
    - Update docstring for `run_full_prediction` function (approximately line 243)
    - Add parameter documentation:
      - `include_gradcam: bool = False — Generate Grad-CAM server-side (legacy/fallback)`
    - Add note explaining default behavior:
      - "Client-side ONNX generation is recommended for production to avoid memory pressure."
      - "Server-side generation available via explicit parameter for debugging or legacy clients."
    - Update FastGradCAM class docstring to clarify when server-side generation is used
    - _Expected_Behavior: Code documentation SHALL clarify default behavior and memory implications_
    - _Preservation: No functional changes, documentation only_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Default Grad-CAM Disabled
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (no server-side Grad-CAM by default)
    - Update the test assertion to match expected fixed behavior:
      - Assert gradcam.available == False for default requests (without explicit parameter)
      - Assert gradcam.image_base64 == None for default requests
      - Assert memory usage stays within safe limits (~200MB baseline, not ~350MB with Grad-CAM)
    - Run bug condition exploration test: `pytest backend/tests/test_bug_condition.py -v`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed, default behavior no longer generates Grad-CAM)
    - Verify concurrent load test: 3-4 simultaneous requests should stay well under 512MB total
    - Document results: "Default requests no longer trigger FastGradCAM, memory stable at ~200MB baseline"
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Buggy Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests: `pytest backend/tests/test_preservation.py -v`
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
    - Verify each preservation property:
      - Classification accuracy unchanged (same predictions on test images)
      - Gatekeeper functionality unchanged (same rejection behavior)
      - API response structure unchanged (all fields present and correct types)
      - Explicit Grad-CAM generation still works (include_gradcam="true" parameter)
      - /api/gradcam endpoint still works (dedicated endpoint unaffected)
    - If any test fails, investigate root cause and fix before proceeding
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Checkpoint - Ensure all tests pass and verify Render deployment
  - Run complete test suite: `pytest backend/tests/ -v --tb=short`
  - Verify all property-based tests pass (bug condition and preservation)
  - Check test coverage: Ensure critical paths are covered (default behavior, explicit Grad-CAM, gatekeeper)
  - Local memory profiling: Use tracemalloc to confirm memory usage stays within expected limits
  - Document test results in .kiro/specs/render-memory-limit-fix/test_results.md
  - Optional: Deploy to Render staging environment and monitor memory metrics
    - Monitor Render dashboard for memory usage under load
    - Verify no process restarts occur during concurrent requests
    - Compare memory usage before/after fix (expect ~150MB reduction per request)
  - If questions arise or memory limits are still exceeded, ask the user for guidance
  - _Requirements: All (2.1-2.5, 3.1-3.6)_
