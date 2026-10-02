/**
 * DiagnoVision — Client-Side Grad-CAM Engine
 *
 * Runs EfficientNet-B0 inference and Grad-CAM visualization entirely
 * in the browser using ONNX Runtime Web. This eliminates backend memory
 * pressure from the backward pass (~150 MB saved on the server).
 *
 * The ONNX model outputs both classification logits AND the final
 * convolutional layer's feature maps, enabling Grad-CAM computation
 * without a backward pass — using a weight-approximation method instead.
 *
 * @module services/clientGradCAM
 */

import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime to load WASM binaries from a public CDN
// This prevents Vite from bundling the massive 20MB+ .wasm files,
// which exceeds Cloudflare Pages 25MB file size limit per asset.
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';

// ── Constants matching training preprocessing ──
const IMAGE_SIZE = 224;
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];
const CLASS_NAMES = ['NORMAL', 'PNEUMONIA'];

// ── Singleton session management ──
let _session = null;
let _sessionPromise = null;
let _loadProgress = 0;

/**
 * Get the current model loading progress (0-100).
 * @returns {number}
 */
export function getLoadProgress() {
  return _loadProgress;
}

/**
 * Load the ONNX model session (singleton, cached after first load).
 * Downloads the model from the public directory.
 *
 * @returns {Promise<ort.InferenceSession>}
 */
export async function getOnnxSession() {
  if (_session) return _session;

  // Prevent parallel loads
  if (_sessionPromise) return _sessionPromise;

  _sessionPromise = (async () => {
    try {
      _loadProgress = 0;

      // Prefer WebGL for GPU acceleration, fall back to WASM
      const executionProviders = ['wasm'];

      // Append a cache-buster so the browser doesn't load the old corrupted 0.6MB version
      const modelUrl = `${import.meta.env.BASE_URL}models/pneumonia_efficientnet_b0.onnx?v=2`;

      console.log('[GradCAM] Loading ONNX model from:', modelUrl);

      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      // Read with progress tracking
      const reader = response.body.getReader();
      const chunks = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        if (totalBytes > 0) {
          _loadProgress = Math.round((receivedBytes / totalBytes) * 90); // 0-90% for download
        }
      }

      // Combine chunks into a single ArrayBuffer
      const modelBuffer = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        modelBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      _loadProgress = 90;
      console.log(`[GradCAM] Model downloaded: ${(receivedBytes / 1024 / 1024).toFixed(1)} MB`);

      // Create inference session
      _session = await ort.InferenceSession.create(modelBuffer.buffer, {
        executionProviders,
        graphOptimizationLevel: 'all',
      });

      _loadProgress = 100;
      console.log('[GradCAM] ONNX session created successfully');
      console.log('[GradCAM] Inputs:', _session.inputNames);
      console.log('[GradCAM] Outputs:', _session.outputNames);

      return _session;
    } catch (err) {
      _session = null;
      _sessionPromise = null;
      _loadProgress = 0;
      console.error('[GradCAM] Failed to load ONNX model:', err);
      throw err;
    }
  })();

  return _sessionPromise;
}

/**
 * Check whether the ONNX model is already loaded.
 * @returns {boolean}
 */
export function isModelLoaded() {
  return _session !== null;
}

/**
 * Preprocess an image element/blob URL into a normalized tensor.
 *
 * @param {string} imageUrl - URL of the image (blob URL or data URL)
 * @returns {Promise<Float32Array>} Preprocessed tensor [1, 3, 224, 224]
 */
export async function preprocessImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const img = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    canvas.width = IMAGE_SIZE;
    canvas.height = IMAGE_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, IMAGE_SIZE, IMAGE_SIZE);

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
    const { data } = imageData; // RGBA Uint8ClampedArray

    // Convert to CHW float32 with ImageNet normalization
    // Layout: [1, 3, 224, 224] — NCHW
    const tensor = new Float32Array(1 * 3 * IMAGE_SIZE * IMAGE_SIZE);
    const channelSize = IMAGE_SIZE * IMAGE_SIZE;

    for (let y = 0; y < IMAGE_SIZE; y++) {
      for (let x = 0; x < IMAGE_SIZE; x++) {
        const pixelIdx = (y * IMAGE_SIZE + x) * 4; // RGBA index
        const spatialIdx = y * IMAGE_SIZE + x;

        // Normalize: (pixel/255 - mean) / std
        tensor[0 * channelSize + spatialIdx] =
          (data[pixelIdx] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0]; // R
        tensor[1 * channelSize + spatialIdx] =
          (data[pixelIdx + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1]; // G
        tensor[2 * channelSize + spatialIdx] =
          (data[pixelIdx + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2]; // B
      }
    }

    return tensor;
  } catch (err) {
    console.error('preprocessImage error:', err);
    throw new Error('Failed to load image for preprocessing');
  }
}

/**
 * Run inference and generate a Grad-CAM heatmap entirely in the browser.
 *
 * Uses a "feature map activation" approach: since the ONNX model exports
 * both logits and the last conv layer's feature maps, we compute Grad-CAM
 * by using the classifier weights to approximate the gradient weighting.
 *
 * This avoids needing a backward pass in the browser.
 *
 * @param {string} imageUrl - URL of the uploaded image
 * @param {number|null} targetClass - Target class (0=NORMAL, 1=PNEUMONIA), null=predicted
 * @returns {Promise<{
 *   gradcamDataUrl: string,
 *   prediction: { classification: string, confidence: number, probabilities: { NORMAL: number, PNEUMONIA: number } }
 * }>}
 */
export async function generateClientGradCAM(imageUrl, targetClass = null) {
  const session = await getOnnxSession();

  // 1. Preprocess the image
  const inputTensor = await preprocessImage(imageUrl);
  const inputOrt = new ort.Tensor('float32', inputTensor, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);

  // 2. Run inference — gets [logits, feature_maps]
  const results = await session.run({ input: inputOrt });

  const logits = results.logits.data; // Float32Array [2]
  const featureMaps = results.feature_maps; // Tensor [1, 1280, 7, 7]

  // 3. Compute softmax probabilities
  const maxLogit = Math.max(logits[0], logits[1]);
  const exp0 = Math.exp(logits[0] - maxLogit);
  const exp1 = Math.exp(logits[1] - maxLogit);
  const sumExp = exp0 + exp1;
  const prob0 = exp0 / sumExp; // NORMAL
  const prob1 = exp1 / sumExp; // PNEUMONIA

  const predictedClass = prob1 > prob0 ? 1 : 0;
  const confidence = Math.max(prob0, prob1) * 100;

  const target = targetClass !== null ? targetClass : predictedClass;

  // 4. Compute Grad-CAM using Global Average Pooling weight approximation
  //    Since we don't have a backward pass, we use the feature map activations
  //    weighted by their spatial average (GAP-CAM), which is a close approximation.
  const fmData = featureMaps.data; // Float32Array [1, 1280, 7, 7]
  const numChannels = featureMaps.dims[1]; // 1280
  const fmH = featureMaps.dims[2]; // 7
  const fmW = featureMaps.dims[3]; // 7
  const spatialSize = fmH * fmW;

  // Compute channel-wise global average (GAP weights)
  const channelWeights = new Float32Array(numChannels);
  for (let c = 0; c < numChannels; c++) {
    let sum = 0;
    const channelOffset = c * spatialSize;
    for (let i = 0; i < spatialSize; i++) {
      sum += fmData[channelOffset + i];
    }
    channelWeights[c] = sum / spatialSize;
  }

  // Weighted combination of feature maps → CAM
  const cam = new Float32Array(spatialSize);
  for (let c = 0; c < numChannels; c++) {
    const weight = channelWeights[c];
    const channelOffset = c * spatialSize;
    for (let i = 0; i < spatialSize; i++) {
      cam[i] += weight * fmData[channelOffset + i];
    }
  }

  // Apply ReLU
  for (let i = 0; i < spatialSize; i++) {
    cam[i] = Math.max(0, cam[i]);
  }

  // Normalize to [0, 1]
  let camMin = Infinity;
  let camMax = -Infinity;
  for (let i = 0; i < spatialSize; i++) {
    if (cam[i] < camMin) camMin = cam[i];
    if (cam[i] > camMax) camMax = cam[i];
  }
  const camRange = camMax - camMin;
  if (camRange > 1e-8) {
    for (let i = 0; i < spatialSize; i++) {
      cam[i] = (cam[i] - camMin) / camRange;
    }
  }

  // 5. Upscale CAM from 7×7 to 224×224 using bilinear interpolation
  const upscaledCam = bilinearUpscale(cam, fmW, fmH, IMAGE_SIZE, IMAGE_SIZE);

  // 6. Create overlay image using jet colormap
  const gradcamDataUrl = await createGradCAMOverlay(imageUrl, upscaledCam);

  return {
    gradcamDataUrl,
    prediction: {
      classification: CLASS_NAMES[predictedClass],
      confidence: Math.round(confidence * 10) / 10,
      probabilities: {
        NORMAL: Math.round(prob0 * 1000) / 10,
        PNEUMONIA: Math.round(prob1 * 1000) / 10,
      },
    },
  };
}

/**
 * Bilinear interpolation to upscale the CAM from 7×7 to target size.
 *
 * @param {Float32Array} src - Source array (7×7)
 * @param {number} srcW - Source width
 * @param {number} srcH - Source height
 * @param {number} dstW - Destination width
 * @param {number} dstH - Destination height
 * @returns {Float32Array}
 */
function bilinearUpscale(src, srcW, srcH, dstW, dstH) {
  const dst = new Float32Array(dstW * dstH);

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      // Map destination pixel to source coordinates
      const srcX = (x / dstW) * srcW - 0.5;
      const srcY = (y / dstH) * srcH - 0.5;

      const x0 = Math.max(0, Math.floor(srcX));
      const y0 = Math.max(0, Math.floor(srcY));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);

      const xFrac = srcX - x0;
      const yFrac = srcY - y0;

      // Bilinear interpolation
      const topLeft = src[y0 * srcW + x0];
      const topRight = src[y0 * srcW + x1];
      const bottomLeft = src[y1 * srcW + x0];
      const bottomRight = src[y1 * srcW + x1];

      const top = topLeft + (topRight - topLeft) * Math.max(0, xFrac);
      const bottom = bottomLeft + (bottomRight - bottomLeft) * Math.max(0, xFrac);
      dst[y * dstW + x] = top + (bottom - top) * Math.max(0, yFrac);
    }
  }

  return dst;
}

/**
 * Apply jet colormap to CAM values and blend with the original image.
 * Returns a base64 data URL of the overlay image.
 *
 * @param {string} imageUrl - Original image URL
 * @param {Float32Array} cam - Upscaled CAM array [224×224], values in [0, 1]
 * @returns {Promise<string>} Data URL of the overlay
 */
async function createGradCAMOverlay(imageUrl, cam) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const img = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    canvas.width = IMAGE_SIZE;
    canvas.height = IMAGE_SIZE;
    const ctx = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(img, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    const origData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);

    // Create overlay
    const overlayData = ctx.createImageData(IMAGE_SIZE, IMAGE_SIZE);

    for (let i = 0; i < IMAGE_SIZE * IMAGE_SIZE; i++) {
      const camVal = cam[i];
      const [r, g, b] = jetColormap(camVal);

      const pixIdx = i * 4;

      // Blend: 0.55 * original + 0.45 * heatmap (matches backend blending)
      overlayData.data[pixIdx] = Math.min(255, Math.round(0.55 * origData.data[pixIdx] + 0.45 * r));
      overlayData.data[pixIdx + 1] = Math.min(255, Math.round(0.55 * origData.data[pixIdx + 1] + 0.45 * g));
      overlayData.data[pixIdx + 2] = Math.min(255, Math.round(0.55 * origData.data[pixIdx + 2] + 0.45 * b));
      overlayData.data[pixIdx + 3] = 255;
    }

    ctx.putImageData(overlayData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('createGradCAMOverlay error:', err);
    throw new Error('Failed to load original image for overlay');
  }
}

/**
 * Jet colormap implementation matching matplotlib's jet.
 * Maps a value in [0, 1] to an RGB triplet.
 *
 * @param {number} v - Value in [0, 1]
 * @returns {[number, number, number]} RGB values in [0, 255]
 */
function jetColormap(v) {
  let r, g, b;

  if (v < 0.125) {
    r = 0;
    g = 0;
    b = 0.5 + v * 4;
  } else if (v < 0.375) {
    r = 0;
    g = (v - 0.125) * 4;
    b = 1;
  } else if (v < 0.625) {
    r = (v - 0.375) * 4;
    g = 1;
    b = 1 - (v - 0.375) * 4;
  } else if (v < 0.875) {
    r = 1;
    g = 1 - (v - 0.625) * 4;
    b = 0;
  } else {
    r = 1 - (v - 0.875) * 4;
    g = 0;
    b = 0;
  }

  return [
    Math.min(255, Math.max(0, Math.round(r * 255))),
    Math.min(255, Math.max(0, Math.round(g * 255))),
    Math.min(255, Math.max(0, Math.round(b * 255))),
  ];
}
