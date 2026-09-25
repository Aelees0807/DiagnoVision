/**
 * DiagnoVision — Mock Prediction Service
 *
 * Isolated mock that returns the EXACT response structure defined in
 * docs/frontend/api-contract.md.  Simulates gatekeeper, pneumonia
 * prediction, Grad-CAM, and error scenarios.
 *
 * ⚠️  REPLACE THIS FILE with a real API call in usePrediction.js once the
 * backend is ready.  The function signature is identical to the real
 * `predictImage` from services/api.js.
 */

/* ---------- tiny deterministic "random" helper ---------- */
const jitter = (base, range) => base + Math.random() * range;

/* ---------- simulated processing delay ---------- */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a realistic Grad-CAM heatmap overlay as base64 PNG (224×224).
 * Uses an off-screen canvas with a jet-like colormap applied to
 * gaussian blobs to simulate model attention regions.
 * @returns {string} base64-encoded PNG without the data URI prefix
 */
function generateRealisticGradCAM() {
  const size = 224;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  /* Start with transparent background */
  ctx.clearRect(0, 0, size, size);

  /* Generate 2-4 gaussian-like attention blobs */
  const blobCount = 2 + Math.floor(Math.random() * 3);
  const blobs = [];
  for (let i = 0; i < blobCount; i++) {
    blobs.push({
      x: 40 + Math.random() * 144,  /* keep blobs centered in chest area */
      y: 50 + Math.random() * 120,
      radius: 30 + Math.random() * 50,
      intensity: 0.4 + Math.random() * 0.6,
    });
  }

  /* Render each blob as a radial gradient with jet-colormap-like colors */
  for (const blob of blobs) {
    const gradient = ctx.createRadialGradient(
      blob.x, blob.y, 0,
      blob.x, blob.y, blob.radius
    );
    const alpha = blob.intensity * 0.65;
    gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
    gradient.addColorStop(0.25, `rgba(255, 165, 0, ${alpha * 0.8})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 0, ${alpha * 0.5})`);
    gradient.addColorStop(0.75, `rgba(0, 255, 0, ${alpha * 0.25})`);
    gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  /* Extract base64 PNG without the data:image/png;base64, prefix */
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
}

/* ─────────────────────────────────────────────────────────
   Scenario Picker
   The mock rotates through realistic scenarios based on the
   file name so tests are reproducible:
     • name contains "normal"   → NORMAL prediction
     • name contains "pneumo"   → PNEUMONIA prediction
     • name contains "cat/dog"  → gatekeeper REJECTED
     • name contains "error"    → 500 error
     • name contains "offline"  → 503 unavailable
     • default                  → PNEUMONIA prediction
   ───────────────────────────────────────────────────────── */

/**
 * Mock implementation of POST /api/predict.
 * @param {File} file - image file
 * @param {function} [onProgress] - optional upload progress callback (0-100)
 * @returns {Promise<Object>} PredictionResponse per api-contract.md
 */
export async function mockPredictImage(file, onProgress) {
  const name = file.name.toLowerCase();

  /* ── simulate upload progress ── */
  if (onProgress) {
    for (let pct = 0; pct <= 90; pct += 10) {
      await delay(80);
      onProgress(pct);
    }
  }

  /* ── simulate server processing ── */
  await delay(jitter(1200, 800));
  if (onProgress) onProgress(100);

  /* ── error scenarios ── */
  if (name.includes('error')) {
    const err = new Error('An error occurred during analysis. Please try again.');
    err.response = {
      status: 500,
      data: {
        status: 'error',
        error_code: 'MODEL_ERROR',
        message: 'An error occurred during analysis. Please try again.',
      },
    };
    throw err;
  }

  if (name.includes('offline') || name.includes('unavailable')) {
    const err = new Error('The prediction service is currently unavailable. Please try again later.');
    err.response = {
      status: 503,
      data: {
        status: 'error',
        error_code: 'MODEL_UNAVAILABLE',
        message: 'The prediction service is currently unavailable. Please try again later.',
      },
    };
    throw err;
  }

  /* ── gatekeeper rejection ── */
  if (name.includes('cat') || name.includes('dog') || name.includes('reject')) {
    return {
      status: 'rejected',
      gatekeeper: {
        result: 'rejected',
        confidence: parseFloat(jitter(90, 8).toFixed(1)),
        label: 'not_chest_xray',
      },
      prediction: null,
      gradcam: null,
      model: null,
      message:
        'This image does not appear to be a frontal chest X-ray. Prediction has been skipped to prevent inaccurate results.',
      processing_time_ms: Math.round(jitter(400, 300)),
    };
  }

  /* ── NORMAL prediction ── */
  if (name.includes('normal') || name.includes('healthy')) {
    const normalProb = parseFloat(jitter(78, 15).toFixed(1));
    const pneumoniaProb = parseFloat((100 - normalProb).toFixed(1));
    return {
      status: 'success',
      gatekeeper: {
        result: 'passed',
        confidence: parseFloat(jitter(95, 4).toFixed(1)),
        label: 'chest_xray',
      },
      prediction: {
        classification: 'NORMAL',
        confidence: normalProb,
        probabilities: {
          NORMAL: normalProb,
          PNEUMONIA: pneumoniaProb,
        },
      },
      gradcam: {
        available: true,
        image_base64: generateRealisticGradCAM(),
      },
      model: {
        name: 'EfficientNet-B0',
        input_size: '224x224',
        checkpoint: 'best_model.pth',
      },
      processing_time_ms: Math.round(jitter(1000, 500)),
    };
  }

  /* ── PNEUMONIA prediction (default) ── */
  const pneumoniaProb = parseFloat(jitter(78, 18).toFixed(1));
  const normalProb = parseFloat((100 - pneumoniaProb).toFixed(1));
  return {
    status: 'success',
    gatekeeper: {
      result: 'passed',
      confidence: parseFloat(jitter(96, 3).toFixed(1)),
      label: 'chest_xray',
    },
    prediction: {
      classification: 'PNEUMONIA',
      confidence: pneumoniaProb,
      probabilities: {
        NORMAL: normalProb,
        PNEUMONIA: pneumoniaProb,
      },
    },
    gradcam: {
      available: true,
      image_base64: generateRealisticGradCAM(),
    },
    model: {
      name: 'EfficientNet-B0',
      input_size: '224x224',
      checkpoint: 'best_model.pth',
    },
    processing_time_ms: Math.round(jitter(1200, 600)),
  };
}
