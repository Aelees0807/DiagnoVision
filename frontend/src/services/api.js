import axios from 'axios';

/**
 * Centralized Axios API client.
 * Base URL configured via VITE_API_URL environment variable.
 * Defaults to http://localhost:8000 for local FastAPI backend.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 60000, // 60s — model inference can take a few seconds
});

/**
 * Submit an X-ray image for prediction.
 * @param {File} file - Image file (JPEG, PNG, or BMP)
 * @param {boolean} [includeGradcam=true] - Whether to generate Grad-CAM
 * @param {Object} [axiosConfig={}] - Extra axios config (signal, onUploadProgress)
 * @returns {Promise<Object>} Prediction response
 */
export const predictImage = async (file, includeGradcam = true, axiosConfig = {}) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('include_gradcam', String(includeGradcam));

  const response = await api.post('/api/predict', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...axiosConfig,
  });
  return response.data;
};

/**
 * Generate Grad-CAM heatmap for an image.
 * @param {File} file - Image file
 * @param {number} [targetClass] - Target class (0=NORMAL, 1=PNEUMONIA)
 * @returns {Promise<Object>} Grad-CAM response
 */
export const generateGradCAM = async (file, targetClass) => {
  const formData = new FormData();
  formData.append('image', file);
  if (targetClass !== undefined) {
    formData.append('target_class', String(targetClass));
  }

  const response = await api.post('/api/gradcam', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Check backend health and model availability.
 * @returns {Promise<Object>} Health status
 */
export const checkHealth = async () => {
  const response = await api.get('/api/health');
  return response.data;
};

export default api;

