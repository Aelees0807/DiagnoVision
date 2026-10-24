import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Scan, XCircle, RotateCcw, Clock, Info, Save, AlertCircle, CheckCircle, Stethoscope } from 'lucide-react';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import GatekeeperStatus from '@/components/prediction/GatekeeperStatus';
import GradCAMViewer from '@/components/prediction/GradCAMViewer';
import PredictionCard from '@/components/prediction/PredictionCard';
import MedicalDisclaimer from '@/components/prediction/MedicalDisclaimer';
import { formatDuration } from '@/utils/formatting';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useClientGradCAM } from '@/hooks/useClientGradCAM';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageUtils';
import ShareWithDoctorModal from '@/components/sharing/ShareWithDoctorModal';

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
  const { isAuthenticated, loading, user } = useAuth();
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [savedPrediction, setSavedPrediction] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const { result, previewUrl, fileName } = location.state || {};

  /* ── Client-side Grad-CAM (fallback when backend Grad-CAM is disabled) ── */
  const {
    gradcamDataUrl: clientGradcamUrl,
    gradcamStatus,
    gradcamError: clientGradcamError,
    modelLoadProgress,
    generateGradCAM,
    isModelReady,
  } = useClientGradCAM();

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

  /* ── Only generate Grad-CAM when prediction is PNEUMONIA ── */
  const isPneumonia =
    result?.status === 'success' &&
    result?.prediction?.classification?.toUpperCase() === 'PNEUMONIA';

  /* ── Auto-generate client-side Grad-CAM when backend doesn't provide one ── */
  useEffect(() => {
    if (
      result &&
      result.status === 'success' &&
      isPneumonia &&
      previewUrl &&
      isModelReady &&
      (!result.gradcam || !result.gradcam.available) &&
      gradcamStatus === 'idle'
    ) {
      generateGradCAM(previewUrl);
    }
  }, [result, previewUrl, isPneumonia, isModelReady, gradcamStatus, generateGradCAM]);

  /* ── Handle Save Result ── */
  const handleSaveResult = async () => {
    if (!user || !previewUrl) return;
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      // 1. Fetch the original image blob from the object URL
      const origRes = await fetch(previewUrl);
      const origBlob = await origRes.blob();
      
      // 2. Compress the original image
      const compressedXray = await compressImage(origBlob, 1024, 0.85);
      
      const timestamp = Date.now();
      const xrayPath = `${user.id}/${timestamp}-xray.jpg`;
      const heatmapPath = `${user.id}/${timestamp}-heatmap.png`;
      
      // 3. Upload X-ray
      const { error: uploadError } = await supabase.storage
        .from('xrays')
        .upload(xrayPath, compressedXray, { contentType: 'image/jpeg' });
        
      if (uploadError) throw uploadError;

      let finalHeatmapPath = null;
      
      // 4. Upload Heatmap if available
      const gradcamDataUrlToUse = hasBackendGradcam ? `data:image/jpeg;base64,${gradcamImage}` : gradcamDataUrl;
      if (gradcamDataUrlToUse) {
        const heatRes = await fetch(gradcamDataUrlToUse);
        const heatBlob = await heatRes.blob();
        
        const { error: heatError } = await supabase.storage
          .from('xrays')
          .upload(heatmapPath, heatBlob, { contentType: heatBlob.type || 'image/png' });
          
        if (!heatError) finalHeatmapPath = heatmapPath;
      }
      
      // 5. Insert DB row
      const { data: insertedData, error: dbError } = await supabase.from('medical_predictions').insert({
        user_id: user.id,
        image_path: xrayPath,
        heatmap_path: finalHeatmapPath,
        predicted_class: result.prediction.classification,
        confidence_score: result.prediction.confidence,
        is_uncertain: result.prediction.confidence < 70
      }).select().single();
      
      if (dbError) throw dbError;
      
      setSavedPrediction(insertedData);
      setSaveStatus({ type: 'success', message: 'Result saved to your history successfully!' });
    } catch (err) {
      console.error('Save result error:', err);
      setSaveStatus({ type: 'error', message: err.message || 'Failed to save result. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!result) return null;

  const isRejected = result.status === 'rejected';
  const gatekeeper = result.gatekeeper;
  const prediction = result.prediction;
  const gradcam = result.gradcam;

  /* ── Resolve Grad-CAM source: prefer backend, fall back to client-side ── */
  const hasBackendGradcam = isPneumonia && gradcam?.available && gradcam?.image_base64;
  const hasClientGradcam = isPneumonia && !!clientGradcamUrl;
  const gradcamImage = hasBackendGradcam
    ? gradcam.image_base64
    : null;
  const gradcamDataUrl = hasClientGradcam ? clientGradcamUrl : null;
  const isGradcamLoading = isPneumonia && !hasBackendGradcam && (gradcamStatus === 'loading-model' || gradcamStatus === 'generating');
  const gradcamErrorMsg = isPneumonia
    ? (hasBackendGradcam ? null : clientGradcamError || null)
    : null;
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
                      gradcamImage={gradcamImage}
                      gradcamDataUrl={gradcamDataUrl}
                      isLoading={isGradcamLoading}
                      loadProgress={modelLoadProgress}
                      error={gradcamErrorMsg}
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
          
          {/* ── Save Status Alert ── */}
          {saveStatus && (
            <div
              className={isRevealed ? 'mb-6 flex justify-center animate-result-card-enter stagger-4' : 'mb-6 flex justify-center'}
              style={{ opacity: 0 }}
            >
              <div className={`inline-flex items-center gap-3 px-4 py-3 rounded-xl border text-sm max-w-lg w-full ${
                saveStatus.type === 'error' ? 'bg-error-bg border-error-light text-error' : 'bg-success-bg border-success-light text-success'
              }`}>
                {saveStatus.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <p>{saveStatus.message}</p>
                {saveStatus.type === 'success' && (
                  <div className="ml-auto flex items-center gap-3">
                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="text-xs font-bold underline hover:no-underline text-success flex items-center gap-1 cursor-pointer"
                    >
                      <Stethoscope className="h-3.5 w-3.5" />
                      Share with Doctor
                    </button>
                    <Link to="/history" className="text-xs font-bold underline hover:no-underline">
                      View History
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Guest Mode Note ── */}
          {!loading && !isAuthenticated && (
            <div
              className={isRevealed ? 'mb-8 flex justify-center animate-result-card-enter stagger-4' : 'mb-8 flex justify-center'}
              style={{ opacity: 0 }}
            >
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-info-bg border border-info-light text-sm text-info">
                <Info className="h-4 w-4 shrink-0" />
                <p>
                  <Link to="/login" className="font-semibold hover:underline">Sign in</Link> to save this result, view history and download a report.
                </p>
              </div>
            </div>
          )}

          {/* ── Medical Disclaimer ── */}
          <div
            className={isRevealed ? 'mb-8 animate-result-card-enter stagger-5' : 'mb-8'}
            style={{ opacity: 0 }}
          >
            <MedicalDisclaimer variant="full" />
          </div>

          {/* ── Action Buttons ── */}
          <div
            className={isRevealed ? 'flex flex-wrap justify-center gap-4 mb-8 animate-result-card-enter stagger-6' : 'flex flex-wrap justify-center gap-4 mb-8'}
            style={{ opacity: 0 }}
          >
            {isAuthenticated && !saveStatus?.type && (
              <Button
                icon={<Save className="h-4 w-4" />}
                onClick={handleSaveResult}
                isLoading={isSaving}
              >
                Save Result
              </Button>
            )}
            {savedPrediction && (
              <Button
                variant="outline"
                icon={<Stethoscope className="h-4 w-4 text-primary" />}
                onClick={() => setIsShareModalOpen(true)}
              >
                Share with Doctor
              </Button>
            )}
            <Link to="/predict">
              <Button
                variant={isAuthenticated && !saveStatus?.type ? 'outline' : 'primary'}
                icon={<Scan className="h-4 w-4" />}
              >
                Analyze Another Image
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Share with Doctor Modal */}
      <ShareWithDoctorModal
        prediction={savedPrediction}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </Container>
  );
}
