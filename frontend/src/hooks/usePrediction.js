import { useState, useCallback, useRef } from 'react';
import { predictImage } from '@/services/api';

/**
 * Custom hook managing the full prediction workflow state machine.
 *
 * States: idle → uploading → processing → success | rejected | error
 *
 * Connected to the real FastAPI backend at /api/predict.
 *
 * @returns {{
 *   status: 'idle'|'uploading'|'processing'|'success'|'rejected'|'error',
 *   result: Object|null,
 *   error: string|null,
 *   uploadProgress: number,
 *   submitPrediction: (file: File) => Promise<void>,
 *   reset: () => void,
 * }}
 */
export function usePrediction() {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  /* Abort controller ref so we can cancel in-flight requests */
  const abortRef = useRef(null);

  /**
   * Submit a file for prediction.
   * Drives the state machine through uploading → processing → result.
   */
  const submitPrediction = useCallback(async (file) => {
    /* reset before starting */
    setResult(null);
    setError(null);
    setUploadProgress(0);
    setStatus('uploading');

    /* create an abort controller for this request */
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // ── Real API call to FastAPI backend ──
      const response = await predictImage(file, true, {
        signal: controller.signal,
        onUploadProgress: (progressEvent) => {
          if (controller.signal.aborted) return;
          const pct = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded)
          );
          setUploadProgress(pct);
          if (pct >= 100) {
            setStatus('processing');
          }
        },
      });

      if (controller.signal.aborted) return;

      if (response.status === 'rejected') {
        setResult(response);
        setStatus('rejected');
      } else if (response.status === 'success') {
        setResult(response);
        setStatus('success');
      } else {
        throw new Error('Unexpected response status');
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      /* extract a user-friendly message */
      const message =
        err?.response?.data?.detail?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'An error occurred during analysis. Please try again.';

      setError(message);
      setStatus('error');
    }
  }, []);

  /**
   * Reset the workflow back to idle so the user can start over.
   */
  const reset = useCallback(() => {
    /* abort any in-flight request */
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus('idle');
    setResult(null);
    setError(null);
    setUploadProgress(0);
  }, []);

  return {
    status,
    result,
    error,
    uploadProgress,
    submitPrediction,
    reset,
  };
}
