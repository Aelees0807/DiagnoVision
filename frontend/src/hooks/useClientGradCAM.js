import { useState, useCallback, useEffect, useRef } from 'react';
import {
  generateClientGradCAM,
  getOnnxSession,
  isModelLoaded,
  getLoadProgress,
} from '@/services/clientGradCAM';

/**
 * Hook managing client-side Grad-CAM generation using ONNX Runtime Web.
 *
 * Preloads the ONNX model on mount, then generates Grad-CAM heatmaps
 * on demand when an image URL is provided.
 *
 * @returns {{
 *   gradcamDataUrl: string|null,
 *   gradcamStatus: 'idle'|'loading-model'|'generating'|'ready'|'error',
 *   gradcamError: string|null,
 *   modelLoadProgress: number,
 *   generateGradCAM: (imageUrl: string) => Promise<void>,
 *   isModelReady: boolean,
 * }}
 */
export function useClientGradCAM() {
  const [gradcamDataUrl, setGradcamDataUrl] = useState(null);
  const [gradcamStatus, setGradcamStatus] = useState('idle');
  const [gradcamError, setGradcamError] = useState(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [isModelReady, setIsModelReady] = useState(isModelLoaded());

  const progressIntervalRef = useRef(null);

  /**
   * Preload the ONNX model on mount for instant Grad-CAM generation later.
   * Runs silently in the background — doesn't block the UI.
   */
  useEffect(() => {
    if (isModelLoaded()) {
      setIsModelReady(true);
      setModelLoadProgress(100);
      return;
    }

    let cancelled = false;
    setGradcamStatus('loading-model');

    // Poll model download progress
    progressIntervalRef.current = setInterval(() => {
      if (!cancelled) {
        setModelLoadProgress(getLoadProgress());
      }
    }, 200);

    getOnnxSession()
      .then(() => {
        if (!cancelled) {
          setIsModelReady(true);
          setModelLoadProgress(100);
          setGradcamStatus('idle');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[useClientGradCAM] Model preload failed:', err.message);
          // Not a critical error — Grad-CAM is optional
          setGradcamStatus('error');
          setGradcamError('Grad-CAM model could not be loaded.');
        }
      })
      .finally(() => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      });

    return () => {
      cancelled = true;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  /**
   * Generate a Grad-CAM heatmap for the given image.
   *
   * @param {string} imageUrl - Blob URL or data URL of the uploaded image
   * @returns {Promise<{gradcamDataUrl: string, prediction: Object}|null>}
   */
  const generateGradCAM = useCallback(async (imageUrl) => {
    if (!imageUrl) return null;

    setGradcamError(null);
    setGradcamStatus('generating');

    try {
      const result = await generateClientGradCAM(imageUrl);
      setGradcamDataUrl(result.gradcamDataUrl);
      setGradcamStatus('ready');
      return result;
    } catch (err) {
      console.error('[useClientGradCAM] Generation failed:', err);
      setGradcamError(`Error: ${err.message}`);
      setGradcamStatus('error');
      return null;
    }
  }, []);

  /**
   * Reset Grad-CAM state (e.g. when user selects a new image).
   */
  const resetGradCAM = useCallback(() => {
    setGradcamDataUrl(null);
    setGradcamError(null);
    setGradcamStatus(isModelLoaded() ? 'idle' : 'loading-model');
  }, []);

  return {
    gradcamDataUrl,
    gradcamStatus,
    gradcamError,
    modelLoadProgress,
    generateGradCAM,
    resetGradCAM,
    isModelReady,
  };
}
