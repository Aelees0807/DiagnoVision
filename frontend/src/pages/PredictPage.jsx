import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, RefreshCw, AlertCircle } from 'lucide-react';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import FileUploader from '@/components/prediction/FileUploader';
import MedicalDisclaimer from '@/components/prediction/MedicalDisclaimer';
import ProcessingOverlay from '@/components/prediction/ProcessingOverlay';
import { usePrediction } from '@/hooks/usePrediction';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Predict page — complete upload → preview → validation → submit → loading workflow.
 * @see docs/frontend/routes.md — /predict
 * @see docs/frontend/components.md — PredictPage hierarchy
 */
export default function PredictPage() {
  useDocumentTitle('Analyze');
  const navigate = useNavigate();
  const { status, result, error, uploadProgress, submitPrediction, reset } =
    usePrediction();

  /* ── local file state ── */
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [validationError, setValidationError] = useState(null);

  /* ── cleanup object URL on unmount or file change ── */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /* ── navigate to result on success/rejected ── */
  useEffect(() => {
    if ((status === 'success' || status === 'rejected') && result) {
      navigate('/result', {
        state: { result, previewUrl, fileName: selectedFile?.name },
      });
    }
  }, [status, result, navigate, previewUrl, selectedFile]);

  /* ── file selection handler ── */
  const handleFileSelect = useCallback(
    (file, fileError) => {
      if (fileError) {
        setValidationError(fileError);
        setSelectedFile(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        return;
      }
      setValidationError(null);
      setSelectedFile(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(file ? URL.createObjectURL(file) : null);
    },
    [previewUrl]
  );

  /* ── file removal ── */
  const handleFileRemove = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    reset();
  }, [previewUrl, reset]);

  /* ── submit ── */
  const handleSubmit = useCallback(() => {
    if (!selectedFile) return;
    submitPrediction(selectedFile);
  }, [selectedFile, submitPrediction]);

  /* ── retry ── */
  const handleRetry = useCallback(() => {
    reset();
    if (selectedFile) {
      submitPrediction(selectedFile);
    }
  }, [reset, selectedFile, submitPrediction]);

  /* ── derived states ── */
  const isProcessing = status === 'uploading' || status === 'processing';
  const hasError = status === 'error';
  const canSubmit = !!selectedFile && !isProcessing;

  return (
    <Container size="md">
      <PageHeader
        title="Analyze X-Ray"
        description="Upload a pediatric chest X-ray image for AI-assisted pneumonia screening."
      />

      {/* ── Processing Overlay (multi-step) ── */}
      {isProcessing && (
        <ProcessingOverlay
          status={status}
          uploadProgress={uploadProgress}
        />
      )}

      {/* ── Upload Zone ── */}
      <div className="mb-6">
        <FileUploader
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
          selectedFile={selectedFile}
          previewUrl={previewUrl}
          error={validationError}
          disabled={isProcessing}
        />
      </div>

      {/* ── Error Card ── */}
      {hasError && (
        <div className="mb-6 rounded-xl border border-error-light bg-error-bg/60 p-5 animate-fade-in-up" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-error mb-1">Analysis Failed</p>
              <p className="text-sm text-error/80">{error}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleRetry}
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* ── Analyze Button ── */}
      <div className="flex justify-center mb-8">
        <Button
          size="lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
          isLoading={isProcessing}
          icon={!isProcessing ? <Scan className="h-5 w-5" /> : undefined}
        >
          Analyze X-Ray
        </Button>
      </div>

      {/* ── Disclaimer ── */}
      <MedicalDisclaimer variant="compact" />
    </Container>
  );
}
