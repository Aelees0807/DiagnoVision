/**
 * DiagnoVision — Application Constants
 * All values derived from repository evaluation data.
 * @see docs/frontend/data-model.md
 */

/** Model performance metrics from test set evaluation (evaluate.py) */
export const MODEL_METRICS = {
  accuracy: 89.10,
  sensitivity: 97.69,
  specificity: 74.79,
  f1_pneumonia: 91.81,
  ppv: 86.59,
  npv: 95.11,
  false_negative_rate: 2.31,
  false_positive_rate: 25.21,
  confusion_matrix: {
    true_normal_pred_normal: 175,
    true_normal_pred_pneumonia: 59,
    true_pneumonia_pred_normal: 9,
    true_pneumonia_pred_pneumonia: 381,
  },
  per_class: {
    NORMAL: { precision: 95.11, recall: 74.79, f1: 83.73, support: 234 },
    PNEUMONIA: { precision: 86.59, recall: 97.69, f1: 91.81, support: 390 },
  },
  test_set_size: 624,
};

/** Model architecture information */
export const PNEUMONIA_MODEL = {
  name: 'EfficientNet-B0',
  input_size: '224x224',
  num_classes: 2,
  class_names: ['NORMAL', 'PNEUMONIA'],
  checkpoint: 'best_model.pth',
};

/** Gatekeeper model info */
export const GATEKEEPER_MODEL = {
  name: 'MobileNetV3-Small',
  purpose: 'Validates that uploaded images are frontal chest X-rays before prediction',
  checkpoint: 'gatekeeper_best.pth',
};

/** File upload constraints */
export const UPLOAD_CONSTRAINTS = {
  acceptedFormats: ['.jpg', '.jpeg', '.png', '.bmp'],
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/bmp'],
  maxSizeMB: 10,
  maxSizeBytes: 10 * 1024 * 1024,
};

/** Dataset information */
export const DATASET_INFO = {
  name: 'Chest X-Ray Images (Pneumonia)',
  source: 'Kaggle',
  url: 'https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia',
  totalImages: 5856,
  classes: ['NORMAL', 'PNEUMONIA'],
  imageType: 'Pediatric chest X-rays, grayscale, JPEG',
  trainSize: 4447,
  valSize: 785,
  testSize: 624,
};

/** Navigation links */
export const NAV_LINKS = [
  { to: '/predict', label: 'Analyze' },
  { to: '/model', label: 'Model Info' },
  { to: '/about', label: 'About' },
];
