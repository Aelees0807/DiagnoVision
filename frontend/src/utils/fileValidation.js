import { UPLOAD_CONSTRAINTS } from '@/constants';

/**
 * Validate an uploaded file against constraints.
 * @param {File} file
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'Please select an image to upload.' };
  }

  const extension = '.' + file.name.split('.').pop().toLowerCase();
  if (!UPLOAD_CONSTRAINTS.acceptedFormats.includes(extension)) {
    return {
      valid: false,
      error: 'Please upload a JPEG, PNG, or BMP image.',
    };
  }

  if (!UPLOAD_CONSTRAINTS.acceptedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a JPEG, PNG, or BMP image.',
    };
  }

  if (file.size > UPLOAD_CONSTRAINTS.maxSizeBytes) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image must be under ${UPLOAD_CONSTRAINTS.maxSizeMB} MB. Your file is ${sizeMB} MB.`,
    };
  }

  return { valid: true, error: null };
}
