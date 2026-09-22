import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Scan, XCircle, RotateCcw, Clock } from 'lucide-react';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import GatekeeperStatus from '@/components/prediction/GatekeeperStatus';
import GradCAMViewer from '@/components/prediction/GradCAMViewer';
import PredictionCard from '@/components/prediction/PredictionCard';
import MedicalDisclaimer from '@/components/prediction/MedicalDisclaimer';
import { formatDuration } from '@/utils/formatting';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Result page — displays prediction result, confidence, Grad-CAM, disclaimer.
 * Receives data via React Router location state; redirects to /predict if empty.
 * Enhanced with glass-panel sections, depth layers, and staggered reveal cascade.
 * @see docs/frontend/routes.md — /result
 * @see docs/frontend/components.md — ResultPage hierarchy
 */
export default function ResultPage() {
  useDocumentTitle('Screening Result');
  const location = useLocation();
  const navigate = useNavigate();
  const [isRevealed, setIsRevealed] = useState(false);

  const { result, previewUrl, fileName } = location.state || {};

  /* ── redirect to /predict if no data ── */
  useEffect(() => {
    if (!result) {
      navigate('/predict', { replace: true });
    }
  }, [result, navigate]);

  /* ── trigger reveal after mount for cascade animations ── */
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setIsRevealed(true), 50);
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (!result) return null;

  const isRejected = result.status === 'rejected';
  const gatekeeper = result.gatekeeper;
  const prediction = result.prediction;
  const gradcam = result.gradcam;
  const model = result.model;

  return (
    <Container size="lg">
      {/* ── Page Title ── */}
      <div className="py-6 md:py-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="text-2xl md:text-3xl font-bold text-foreground tracking-tight animate-fade-in-up"
          >
            Screening Result
          </h1>
          {result.processing_time_ms && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-panel text-xs font-medium text-secondary animate-fade-in-up stagger-1"
              style={{ opacity: 0 }}
            >
              <Clock className="h-3 w-3" />
              {formatDuration(result.processing_time_ms)}
            </span>
          )}
        </div>
      </div>

      {/* ── Gatekeeper Status Bar ── */}
      <div
        className="mb-6"
        style={{ opacity: isRevealed ? 1 : 0 }}
      >
        <div className={isRevealed ? 'animate-gatekeeper-enter' : ''}>
          <GatekeeperStatus
            status={gatekeeper.result}
            confidence={gatekeeper.confidence}
          />
        </div>
      </div>

      {isRejected ? (
        /* ═══════════════════════════════════════════
           REJECTED Layout — glass-panel treatment
           ═══════════════════════════════════════════ */
        <div style={{ opacity: isRevealed ? 1 : 0 }}>
          <div
            className={isRevealed ? 'animate-result-card-enter stagger-2' : ''}
            style={{ opacity: 0 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Left: uploaded image */}
              <div className="flex justify-center">
                {previewUrl && (
                  <div className="glass-panel rounded-2xl p-4 result-depth-layer">
                    <div className="rounded-xl overflow-hidden bg-gray-900">
                      <img
                        src={previewUrl}
                        alt="Uploaded image"
                        className="block w-full h-auto object-contain max-h-[320px]"
                      />
                    </div>
                    {fileName && (
                      <p className="text-xs text-secondary text-center mt-3 truncate">
                        {fileName}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right: rejection message */}
              <div className="flex flex-col justify-center">
                <div className="glass-panel rounded-xl p-6 border-pneumonia-light/40">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-pneumonia/10 flex items-center justify-center">
                      <XCircle className="h-5 w-5 text-pneumonia" />
                    </div>
                    <h2 className="text-lg font-bold text-pneumonia">Image Rejected</h2>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-3">
                    {result.message ||
                      'This image does not appear to be a frontal chest X-ray. Prediction has been skipped to prevent inaccurate results.'}
                  </p>
                  <p className="text-sm text-secondary">
                    Please upload a valid pediatric chest X-ray image.
                  </p>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="flex justify-center mb-8">
              <Link to="/predict">
                <Button
                  icon={<RotateCcw className="h-4 w-4" />}
                >
                  Try Another Image
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════
           SUCCESS Layout — glass panels with depth
           ═══════════════════════════════════════════ */
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* ── Left Column: Images ── */}
            <div className="space-y-6">
              {previewUrl && (
                <div
                  className={isRevealed ? 'animate-result-card-enter stagger-2' : ''}
                  style={{ opacity: 0 }}
                >
                  <div className="glass-panel rounded-2xl p-4 result-depth-layer">
                    <GradCAMViewer
                      originalImage={previewUrl}
                      gradcamImage={gradcam?.available ? gradcam.image_base64 : null}
                      isLoading={false}
                      error={gradcam?.available ? null : 'Visual explanation unavailable'}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Right Column: Prediction Result ── */}
            <div className="space-y-6">
              {prediction && (
                <div
                  className={isRevealed ? 'animate-result-card-enter stagger-3' : ''}
                  style={{ opacity: 0 }}
                >
                  <div className="result-depth-layer">
                    <PredictionCard
                      prediction={prediction.classification}
                      confidence={prediction.confidence}
                      normalProbability={prediction.probabilities.NORMAL}
                      pneumoniaProbability={prediction.probabilities.PNEUMONIA}
                      modelName={model?.name}
                      animated={isRevealed}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Medical Disclaimer ── */}
          <div
            className={isRevealed ? 'mb-8 animate-result-card-enter stagger-5' : 'mb-8'}
            style={{ opacity: 0 }}
          >
            <MedicalDisclaimer variant="full" />
          </div>

          {/* ── Action Buttons ── */}
          <div
            className={isRevealed ? 'flex justify-center gap-4 mb-8 animate-result-card-enter stagger-6' : 'flex justify-center gap-4 mb-8'}
            style={{ opacity: 0 }}
          >
            <Link to="/predict">
              <Button
                icon={<Scan className="h-4 w-4" />}
              >
                Analyze Another Image
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Container>
  );
}
