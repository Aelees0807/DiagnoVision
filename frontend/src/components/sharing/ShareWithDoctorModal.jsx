import { useState, useEffect } from 'react';
import { 
  X, Stethoscope, Copy, Check, ShieldCheck, Clock, 
  AlertCircle, Trash2, KeyRound 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { createScanShare, getScanShares, revokeScanShare } from '@/services/shareService';

export default function ShareWithDoctorModal({ prediction, isOpen, onClose }) {
  const [activeShare, setActiveShare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && prediction?.id) {
      loadShare();
    }
  }, [isOpen, prediction]);

  const loadShare = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await getScanShares(prediction.id);
      if (err) throw err;

      // Find an active share if exists
      const active = data?.find(s => s.status === 'active' && new Date(s.expires_at) > new Date());
      const claimed = data?.find(s => s.status === 'claimed');

      setActiveShare(active || claimed || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    try {
      setCreating(true);
      setError(null);
      const { data, error: err } = await createScanShare(prediction.id);
      if (err) throw err;
      setActiveShare(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!activeShare) return;
    try {
      setRevoking(true);
      setError(null);
      const { error: err } = await revokeScanShare(activeShare.id);
      if (err) throw err;
      setActiveShare(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = () => {
    if (!activeShare?.share_code) return;
    navigator.clipboard.writeText(activeShare.share_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Share with Doctor</h3>
            <p className="text-xs text-secondary mt-0.5">
              Scan #{prediction.id} · {prediction.predicted_class} ({prediction.confidence_score?.toFixed(1)}%)
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-error-bg border border-error-light text-error text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Spinner size="md" className="text-primary mb-3" />
            <p className="text-xs text-muted">Checking authorization status…</p>
          </div>
        ) : activeShare ? (
          <div className="space-y-5">
            {/* Status indicator */}
            {activeShare.status === 'claimed' ? (
              <div className="p-4 rounded-xl bg-success-bg border border-success-light text-success flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-sm">Connected to Doctor</p>
                  This scan has been connected to your doctor&apos;s clinical chart for review.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-info-bg border border-info-light text-info flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-sm">Secure Share Code Ready</p>
                  Give this code to your doctor so they can link your X-ray to your medical record.
                </div>
              </div>
            )}

            {/* Large Code Badge */}
            <div className="p-5 rounded-2xl bg-surface border-2 border-primary/20 text-center relative group">
              <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                Your One-Time Medical Access Code
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-widest text-primary">
                  {activeShare.share_code}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2.5 rounded-xl border border-primary/30 hover:bg-primary hover:text-white text-primary transition-all cursor-pointer"
                  title="Copy Code"
                >
                  {copied ? <Check className="h-5 w-5 text-success" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted mt-2">
                {copied ? (
                  <span className="text-success font-semibold">Copied to clipboard!</span>
                ) : (
                  `Expires in ${Math.ceil((new Date(activeShare.expires_at) - new Date()) / (1000 * 60 * 60 * 24))} days`
                )}
              </p>
            </div>

            {/* How it works instructions */}
            <div className="p-4 rounded-xl bg-surface-hover/60 border border-border/40 text-xs text-secondary space-y-2">
              <p className="font-semibold text-foreground">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-muted">
                <li>Your doctor enters this code in their DiagnoVision Portal.</li>
                <li>No other medical staff can view this scan without your code.</li>
                <li>You can revoke access at any time using the button below.</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {activeShare.status !== 'claimed' && (
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="text-xs text-error hover:text-error/80 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {revoking ? 'Revoking…' : 'Cancel & Revoke Code'}
                </button>
              )}
              <div className="ml-auto">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Generate Code State */
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
              <KeyRound className="h-8 w-8" />
            </div>

            <div className="max-w-sm mx-auto">
              <h4 className="text-base font-bold text-foreground mb-1">
                Share this X-Ray with a Doctor
              </h4>
              <p className="text-xs text-secondary leading-relaxed">
                Generate a secure, single-use access code to give to your physician during consultation. Your scan remains completely private until you share this code.
              </p>
            </div>

            <Button
              variant="primary"
              onClick={handleGenerateCode}
              isLoading={creating}
              icon={<ShieldCheck className="h-4 w-4" />}
              className="w-full max-w-xs mx-auto"
            >
              Generate Share Code
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
