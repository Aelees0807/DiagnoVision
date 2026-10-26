import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, AlertTriangle, Shield, Clock,
  CheckCircle, RefreshCw, User, FileText, MessageSquare,
  Calendar, Activity, Eye, Send, Edit3, Link2, UserPlus
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  fetchPredictionDetail, submitReview, fetchReviewsForPrediction,
  fetchPatients, linkPredictionToPatient
} from '@/services/staffService';
import { supabase } from '@/lib/supabase';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

export default function ScanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user, isAdmin } = useAuth();
  useDocumentTitle('Scan Detail');

  const [prediction, setPrediction] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Image URLs
  const [imageUrl, setImageUrl] = useState(null);
  const [heatmapUrl, setHeatmapUrl] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [imageError, setImageError] = useState(null);

  // Review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    verdict: 'confirmed',
    overrideClass: 'NORMAL',
    clinicalNotes: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Patient linking
  const [showLinkPatient, setShowLinkPatient] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [linkingPatient, setLinkingPatient] = useState(false);

  // Disease info
  const [diseaseInfo, setDiseaseInfo] = useState(null);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await fetchPredictionDetail(id);
      if (err) throw err;
      if (!data) throw new Error('Prediction not found');
      setPrediction(data);

      // Load reviews
      const { data: reviewData } = await fetchReviewsForPrediction(id);
      setReviews(reviewData || []);

      // Load signed URLs for images
      setImageError(null);
      if (data.image_path) {
        const cleanPath = data.image_path.replace(/^\/+/, '');
        const { data: urlData, error: imgError } = await supabase.storage
          .from('xrays')
          .createSignedUrl(cleanPath, 3600);
        
        if (imgError) {
          console.error('[ScanDetailPage] Error creating signed URL for image:', imgError);
          setImageError(imgError.message || 'Storage permission denied');
        } else if (urlData?.signedUrl) {
          setImageUrl(urlData.signedUrl);
        }
      }
      if (data.heatmap_path) {
        const cleanHeatPath = data.heatmap_path.replace(/^\/+/, '');
        const { data: urlData, error: heatError } = await supabase.storage
          .from('xrays')
          .createSignedUrl(cleanHeatPath, 3600);
        
        if (heatError) {
          console.warn('[ScanDetailPage] Error creating signed URL for heatmap:', heatError);
        } else if (urlData?.signedUrl) {
          setHeatmapUrl(urlData.signedUrl);
        }
      }

      // Load disease info
      const { data: infoData } = await supabase
        .from('disease_info')
        .select('*')
        .eq('class_name', data.predicted_class)
        .single();
      if (infoData) setDiseaseInfo(infoData);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      setSubmittingReview(true);
      const { error: err } = await submitReview({
        predictionId: parseInt(id),
        verdict: reviewForm.verdict,
        overrideClass: reviewForm.overrideClass,
        clinicalNotes: reviewForm.clinicalNotes,
      });
      if (err) throw err;

      setShowReviewForm(false);
      setReviewForm({ verdict: 'confirmed', overrideClass: 'NORMAL', clinicalNotes: '' });
      loadDetail(); // Refresh
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleLinkPatient = async () => {
    if (!selectedPatientId) return;
    try {
      setLinkingPatient(true);
      const targetPatientId = selectedPatientId === 'unlink' ? null : parseInt(selectedPatientId);
      const { error: err } = await linkPredictionToPatient(parseInt(id), targetPatientId);
      if (err) throw err;
      setShowLinkPatient(false);
      setSelectedPatientId('');
      loadDetail();
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkingPatient(false);
    }
  };

  const loadPatientsList = async () => {
    const { data } = await fetchPatients({ limit: 100 });
    setPatients(data || []);
    setShowLinkPatient(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner size="lg" className="text-primary mb-4" />
        <p className="text-secondary font-medium animate-pulse">Loading scan details…</p>
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <Container size="lg" className="py-12">
        <div className="glass rounded-2xl p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            {error || 'Scan not found'}
          </h2>
          <Link to={isAdmin ? "/admin" : "/staff/scans"}>
            <Button variant="secondary" className="mt-4">
              {isAdmin ? 'Back to Admin Console' : 'Back to Scans'}
            </Button>
          </Link>
        </div>
      </Container>
    );
  }

  const isPneumonia = prediction.predicted_class === 'PNEUMONIA';
  const patient = prediction.patients;
  const finalVerdict = reviews.length > 0 && reviews[0].verdict === 'overridden'
    ? reviews[0].override_class
    : prediction.predicted_class;

  // Resolve patient display name (for admin oversight)
  const patientDisplayName =
    patient?.patient_name ||
    prediction.profiles?.full_name ||
    (prediction.profiles?.email ? prediction.profiles.email.split('@')[0] : null) ||
    (isAdmin ? 'Direct Intake' : null);

  const isOwnScan = user?.id && prediction.user_id === user.id;

  return (
    <Container size="xl" className="py-8 md:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted mb-6 animate-fade-in-up">
        {isAdmin ? (
          <>
            <Link to="/admin" className="hover:text-primary transition-colors flex items-center gap-1.5 font-medium">
              <Shield className="h-4 w-4 text-indigo-500" />
              <span>Admin Console</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
            <Link to="/admin" className="hover:text-primary transition-colors font-medium">Hospital Scans</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
            <span className="text-foreground font-semibold font-mono">Scan #{prediction.id}</span>
          </>
        ) : (
          <>
            <Link to="/staff" className="hover:text-primary transition-colors">Dashboard</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/staff/scans" className="hover:text-primary transition-colors">Scans</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">#{prediction.id}</span>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column: Image + Heatmap ── */}
        <div className="lg:col-span-1 space-y-4">
          {/* X-Ray Image */}
          <div className="glass rounded-2xl overflow-hidden border border-border/30 animate-fade-in-up shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-border/30">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 shrink-0">
                  <Eye className="h-4 w-4 text-primary" />
                  {showHeatmap ? 'Grad-CAM Heatmap' : 'Original X-Ray'}
                </h3>
                {/* Admin-only Patient Label at the X-ray (Hidden from doctor view for privacy) */}
                {isAdmin && patientDisplayName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 truncate" title={`Patient: ${patientDisplayName}`}>
                    <User className="h-3 w-3 text-indigo-500 shrink-0" />
                    <span className="truncate">{patientDisplayName}</span>
                  </span>
                )}
              </div>
              {heatmapUrl && (
                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className="text-xs text-primary font-medium hover:text-primary-hover transition-colors cursor-pointer shrink-0 ml-2"
                >
                  {showHeatmap ? 'Show Original' : 'Show Heatmap'}
                </button>
              )}
            </div>
            <div className="aspect-square bg-foreground/5 flex items-center justify-center relative overflow-hidden">
              {/* Admin Floating Badge directly on the X-ray viewer */}
              {isAdmin && patientDisplayName && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-indigo-500/40 text-xs font-semibold text-white shadow-lg pointer-events-none animate-fade-in">
                  <User className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span>Patient: <strong className="text-indigo-200">{patientDisplayName}</strong></span>
                  {patient?.patient_id && (
                    <span className="text-[10px] text-slate-400 font-mono">({patient.patient_id})</span>
                  )}
                  {isOwnScan && (
                    <span className="ml-1 text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">
                      Your Upload
                    </span>
                  )}
                </div>
              )}

              {(showHeatmap ? heatmapUrl : imageUrl) ? (
                <img
                  src={showHeatmap ? heatmapUrl : imageUrl}
                  alt={showHeatmap ? 'Grad-CAM heatmap' : 'Chest X-ray'}
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 space-y-2 max-w-xs">
                  <Activity className="h-10 w-10 text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium text-foreground">
                    {imageError ? 'Unable to load preview' : 'No image available'}
                  </p>
                  {imageError && (
                    <p className="text-xs text-error leading-relaxed">
                      {imageError} — check Supabase storage RLS policy.
                    </p>
                  )}
                  {prediction.image_path && (
                    <p className="text-[10px] font-mono text-muted/70 break-all bg-surface p-1.5 rounded border border-border/40">
                      {prediction.image_path}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Admin Oversight Banner under X-Ray */}
            {isAdmin && (
              <div className="px-4 py-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 border-t border-border/30 flex items-center justify-between text-xs text-secondary">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Patient: <strong className="text-indigo-600 dark:text-indigo-400">{patientDisplayName}</strong></span>
                  {isOwnScan && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold ml-1">
                      Your Upload
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted italic hidden sm:inline">
                  Admin Oversight (Private from doctor view)
                </span>
              </div>
            )}
          </div>

          {/* Patient Info / Link Patient */}
          <div className="glass rounded-2xl p-5 border border-border/30 animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Patient Assignment
              </h3>
              {patient ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-success/10 text-success border border-success/30">
                  Assigned
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30">
                  Unassigned Intake
                </span>
              )}
            </div>
            {patient ? (
              <div className="space-y-2">
                <p className="text-sm font-bold text-foreground">{patient.patient_name}</p>
                {patient.patient_id && <p className="text-xs text-muted">Hospital Record ID: {patient.patient_id}</p>}
                {patient.age && <p className="text-xs text-muted">Age: {patient.age} {patient.gender ? `· ${patient.gender}` : ''}</p>}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between mt-3">
                  {isAdmin ? (
                    <Link
                      to="/admin"
                      className="text-xs text-primary font-semibold hover:text-primary-hover flex items-center gap-1 transition-colors"
                    >
                      Hospital Records Console <ChevronRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <Link
                      to={`/staff/scans?patientId=${patient.id}`}
                      className="text-xs text-primary font-semibold hover:text-primary-hover flex items-center gap-1 transition-colors"
                    >
                      All patient scans <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                  {!isAdmin && (
                    <button
                      onClick={loadPatientsList}
                      className="text-xs text-muted hover:text-primary transition-colors cursor-pointer"
                    >
                      Reassign
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-secondary mb-3 leading-relaxed">
                  This scan is in the hospital intake triage pool.
                </p>
                {!isAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={loadPatientsList}
                    icon={<Link2 className="h-3.5 w-3.5" />}
                    className="w-full"
                  >
                    Claim & Assign to Patient
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Admin Oversight Card: Uploaded By Whomever (Strictly hidden from doctors for patient privacy) */}
          {isAdmin && (
            <div className="glass rounded-2xl p-4 border border-indigo-500/25 bg-indigo-500/5 shadow-xs animate-fade-in-up">
              <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                <Shield className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                Admin Audit · Upload Origin
              </h4>
              <div className="p-3 rounded-xl bg-surface border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    {isOwnScan ? (
                      <span>You (Hospital Administrator)</span>
                    ) : (
                      <span>{prediction.profiles?.full_name || 'Direct Patient / Anonymous'}</span>
                    )}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                    {prediction.profiles?.role === 'admin' ? 'Hospital Admin' : prediction.profiles?.role === 'medical_staff' ? 'Medical Staff' : 'Patient Direct'}
                  </span>
                </div>
                {prediction.profiles?.email && (
                  <p className="text-[11px] text-muted font-mono">{prediction.profiles.email}</p>
                )}
                {isOwnScan && (
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold pt-1 border-t border-border/40">
                    ✓ Uploaded directly by your administrator account
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Details + Review ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* AI Result Card */}
          <div className={`glass rounded-2xl p-6 border-2 animate-fade-in-up ${
            isPneumonia ? 'border-pneumonia/30' : 'border-success/30'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                isPneumonia ? 'bg-pneumonia/10' : 'bg-success/10'
              }`}>
                <Shield className={`h-7 w-7 ${isPneumonia ? 'text-pneumonia' : 'text-success'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h2 className={`text-2xl font-bold ${isPneumonia ? 'text-pneumonia' : 'text-success'}`}>
                    {prediction.predicted_class}
                  </h2>
                  <span className="text-lg font-mono text-muted">
                    {prediction.confidence_score.toFixed(1)}%
                  </span>
                  {prediction.is_uncertain && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-warning/10 text-warning border border-warning/30">
                      <AlertTriangle className="h-3 w-3" />
                      UNCERTAIN
                    </span>
                  )}
                </div>

                {/* Confidence Bar */}
                <div className="mb-3">
                  <div className="h-3 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        isPneumonia ? 'bg-pneumonia' : 'bg-success'
                      }`}
                      style={{ width: `${prediction.confidence_score}%` }}
                    />
                  </div>
                </div>

                {/* Status Row */}
                <div className="flex items-center gap-4 text-sm text-muted flex-wrap">
                  <StatusBadge status={prediction.review_status} />
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(prediction.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="font-mono text-xs">Scan #{prediction.id}</span>
                </div>
              </div>
            </div>

            {/* Override banner */}
            {reviews.length > 0 && reviews[0].verdict === 'overridden' && (
              <div className="mt-4 p-3 rounded-xl bg-pneumonia/5 border border-pneumonia/20">
                <div className="flex items-center gap-2 text-sm">
                  <RefreshCw className="h-4 w-4 text-pneumonia" />
                  <span className="font-semibold text-pneumonia">Overridden to:</span>
                  <span className="font-bold text-foreground">{reviews[0].override_class}</span>
                  <span className="text-muted ml-auto text-xs">
                    by {reviews[0].profiles?.full_name || 'Staff'} · {new Date(reviews[0].created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Disease Info Card */}
          {diseaseInfo && (
            <div className="glass rounded-2xl p-5 border border-border/30 animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                Screening Information
              </h3>
              <p className="text-sm text-secondary mb-3">{diseaseInfo.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-surface-hover/50">
                  <p className="text-xs text-muted font-semibold uppercase mb-1">Affected Area</p>
                  <p className="text-secondary">{diseaseInfo.affected_area}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-hover/50">
                  <p className="text-xs text-muted font-semibold uppercase mb-1">Cause</p>
                  <p className="text-secondary">{diseaseInfo.cause}</p>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-info/5 border border-info/20">
                <p className="text-xs text-muted font-semibold uppercase mb-1">Recommended Action</p>
                <p className="text-sm text-secondary">{diseaseInfo.recommended_action}</p>
              </div>
            </div>
          )}

          {/* Review History */}
          {reviews.length > 0 && (
            <div className="glass rounded-2xl p-5 border border-border/30 animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-primary" />
                Review History ({reviews.length})
              </h3>
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="p-4 rounded-xl bg-surface-hover/50 border border-border/20">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={review.verdict} />
                      {review.verdict === 'overridden' && (
                        <span className="text-xs text-pneumonia font-semibold">→ {review.override_class}</span>
                      )}
                      <span className="ml-auto text-xs text-muted">
                        {review.profiles?.full_name || 'Staff'} · {new Date(review.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {review.clinical_notes && (
                      <p className="text-sm text-secondary mt-2 pl-1 border-l-2 border-primary/30 ml-1">
                        {review.clinical_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Review Button / Form */}
          {!showReviewForm ? (
            <div className="flex gap-3 animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
              <Button
                variant="primary"
                onClick={() => setShowReviewForm(true)}
                icon={<Edit3 className="h-4 w-4" />}
              >
                Add Review
              </Button>
              <Link to={isAdmin ? "/admin" : "/staff/scans"}>
                <Button variant="outline" icon={<ChevronLeft className="h-4 w-4" />}>
                  {isAdmin ? 'Back to Admin Console' : 'Back to Scans'}
                </Button>
              </Link>
            </div>
          ) : (
            /* Review Form */
            <div className="glass rounded-2xl p-6 border-2 border-primary/30 animate-scale-in">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-5">
                <Edit3 className="h-5 w-5 text-primary" />
                Submit Review
              </h3>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                {/* Verdict */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Verdict</label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      reviewForm.verdict === 'confirmed'
                        ? 'border-success bg-success/5'
                        : 'border-border hover:border-success/50'
                    }`}>
                      <input
                        type="radio"
                        name="verdict"
                        value="confirmed"
                        checked={reviewForm.verdict === 'confirmed'}
                        onChange={() => setReviewForm(prev => ({ ...prev, verdict: 'confirmed' }))}
                        className="sr-only"
                      />
                      <CheckCircle className={`h-5 w-5 ${reviewForm.verdict === 'confirmed' ? 'text-success' : 'text-muted'}`} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Confirm</p>
                        <p className="text-xs text-muted">AI prediction is correct</p>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      reviewForm.verdict === 'overridden'
                        ? 'border-pneumonia bg-pneumonia/5'
                        : 'border-border hover:border-pneumonia/50'
                    }`}>
                      <input
                        type="radio"
                        name="verdict"
                        value="overridden"
                        checked={reviewForm.verdict === 'overridden'}
                        onChange={() => setReviewForm(prev => ({ ...prev, verdict: 'overridden' }))}
                        className="sr-only"
                      />
                      <RefreshCw className={`h-5 w-5 ${reviewForm.verdict === 'overridden' ? 'text-pneumonia' : 'text-muted'}`} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Override</p>
                        <p className="text-xs text-muted">Change the classification</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Override class selection */}
                {reviewForm.verdict === 'overridden' && (
                  <div className="animate-fade-in-up">
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Correct Classification
                    </label>
                    <select
                      value={reviewForm.overrideClass}
                      onChange={e => setReviewForm(prev => ({ ...prev, overrideClass: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                      <option value="NORMAL">NORMAL</option>
                      <option value="PNEUMONIA">PNEUMONIA</option>
                    </select>
                  </div>
                )}

                {/* Clinical Notes */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Clinical Notes <span className="text-muted font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={reviewForm.clinicalNotes}
                    onChange={e => setReviewForm(prev => ({ ...prev, clinicalNotes: e.target.value }))}
                    placeholder="Add clinical observations, differential diagnoses, recommended follow-up..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowReviewForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={submittingReview}
                    icon={<Send className="h-4 w-4" />}
                  >
                    Submit Review
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Link Patient Modal */}
      {showLinkPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowLinkPatient(false)}>
          <div
            className="glass-strong rounded-2xl w-full max-w-md p-6 shadow-xl animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Link Patient to Scan
            </h3>

            {patients.length === 0 ? (
              <div className="text-center py-6">
                <User className="h-10 w-10 text-muted mx-auto mb-3" />
                <p className="text-sm text-secondary mb-4">No patients found. Create a patient first.</p>
                <Link to="/staff/patients?action=new">
                  <Button variant="primary" size="sm" icon={<UserPlus className="h-4 w-4" />}>
                    Create Patient
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <select
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all mb-4 cursor-pointer"
                >
                  <option value="">Select a patient...</option>
                  {prediction?.patient_id && (
                    <option value="unlink">✕ Detach from Patient (Reset to Unassigned Intake)</option>
                  )}
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} {p.patient_id ? `(${p.patient_id})` : ''}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setShowLinkPatient(false)}>Cancel</Button>
                  <Button
                    variant="primary"
                    onClick={handleLinkPatient}
                    isLoading={linkingPatient}
                    disabled={!selectedPatientId}
                  >
                    Link Patient
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Container>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function StatusBadge({ status }) {
  const config = {
    pending: { icon: Clock, color: 'text-warning bg-warning/10 border-warning/30', label: 'Pending' },
    reviewed: { icon: Eye, color: 'text-info bg-info/10 border-info/30', label: 'Reviewed' },
    confirmed: { icon: CheckCircle, color: 'text-success bg-success/10 border-success/30', label: 'Confirmed' },
    overridden: { icon: RefreshCw, color: 'text-pneumonia bg-pneumonia/10 border-pneumonia/30', label: 'Overridden' },
  };

  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${c.color}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
