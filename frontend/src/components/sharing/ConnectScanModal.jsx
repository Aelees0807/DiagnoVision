import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  X, Link2, User, UserPlus, AlertCircle, CheckCircle2, 
  ShieldCheck, ArrowRight 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fetchPatients, connectPatientScanByCode } from '@/services/staffService';

export default function ConnectScanModal({ isOpen, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [shareCode, setShareCode] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setShareCode('');
      setSelectedPatientId('');
      setError(null);
      setSuccessResult(null);
      loadPatients();
    }
  }, [isOpen]);

  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      const { data, error: err } = await fetchPatients({ limit: 100 });
      if (err) throw err;
      setPatients(data || []);
      if (data?.length === 1) {
        setSelectedPatientId(data[0].id.toString());
      }
    } catch (err) {
      console.error('[ConnectScanModal] Error loading patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanCode = shareCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter the patient share code.');
      return;
    }

    if (!selectedPatientId) {
      setError('Please select which of your patients this scan belongs to.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { data, error: err } = await connectPatientScanByCode({
        shareCode: cleanCode,
        patientId: selectedPatientId,
      });

      if (err) throw new Error(err);

      setSuccessResult(data);
      if (onSuccess) onSuccess(data);
    } catch (err) {
      setError(err.message || 'Failed to connect scan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="glass-strong rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl animate-scale-in border border-border/40 relative bg-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-muted hover:text-foreground rounded-lg transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
            <Link2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Connect Patient Scan</h3>
            <p className="text-xs text-secondary mt-0.5">
              Securely import a patient&apos;s scan with their authorized access code
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-error-bg border border-error-light text-error text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {successResult ? (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-success-bg border border-success-light text-success flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-foreground">Scan Connected Successfully!</h4>
              <p className="text-xs text-secondary mt-1">
                Linked to <strong>{successResult.patient_name}</strong>. It is now part of your clinical review records.
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  navigate(`/staff/scans/${successResult.prediction_id}`);
                }}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Open Scan Review
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Share Code Input */}
            <div>
              <label htmlFor="share-code" className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Patient Share Code (from patient)
              </label>
              <input
                id="share-code"
                type="text"
                autoFocus
                required
                value={shareCode}
                onChange={e => setShareCode(e.target.value.toUpperCase())}
                placeholder="e.g. DV-849201"
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface font-mono font-bold text-xl tracking-wider text-primary text-center focus:outline-none transition-all placeholder:text-muted/60 uppercase"
              />
              <p className="text-[11px] text-muted mt-1.5 text-center">
                The patient generates this code on their screening result screen.
              </p>
            </div>

            {/* Select Patient */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="select-patient" className="block text-xs font-semibold text-secondary uppercase tracking-wider">
                  Assign to Patient Chart
                </label>
                <Link
                  to="/staff/patients?action=new"
                  className="text-xs text-primary font-semibold hover:text-primary-hover flex items-center gap-1 transition-colors"
                >
                  <UserPlus className="h-3 w-3" /> New Patient
                </Link>
              </div>

              {loadingPatients ? (
                <div className="p-3 text-center text-xs text-muted">Loading your patients…</div>
              ) : patients.length === 0 ? (
                <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 text-xs text-warning space-y-2">
                  <p className="font-semibold">No registered patients found.</p>
                  <p>You must have at least one registered patient to connect an external scan.</p>
                  <Link to="/staff/patients?action=new">
                    <Button variant="secondary" size="sm" className="w-full mt-1">
                      Register Patient First
                    </Button>
                  </Link>
                </div>
              ) : (
                <select
                  id="select-patient"
                  required
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="">Select one of your patients...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.patient_name} {p.patient_id ? `(Hospital ID: ${p.patient_id})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Privacy Compliance Callout */}
            <div className="p-3 rounded-xl bg-surface-hover/60 border border-border/40 flex items-start gap-2.5 text-[11px] text-muted leading-relaxed">
              <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <span>
                <strong>HIPAA & GDPR Consent Rule:</strong> Scans can only be imported with explicit authorization code from the patient.
              </span>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                isLoading={isSubmitting}
                disabled={patients.length === 0 || !shareCode.trim() || !selectedPatientId}
                icon={<Link2 className="h-4 w-4" />}
              >
                Connect Scan
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
