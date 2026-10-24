import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { KeyRound, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  useDocumentTitle('Reset Password');
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUserPassword, signOut, session } = useAuth();

  const [hasValidSession, setHasValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Check if user arrived via recovery link or has active session
  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      try {
        // If there's an active session in AuthContext
        if (session) {
          if (mounted) {
            setHasValidSession(true);
            setCheckingSession(false);
          }
          return;
        }

        // Check if there is an access_token or code in URL hash / query
        const hash = window.location.hash;
        const search = window.location.search;

        if (hash.includes('access_token') || hash.includes('type=recovery') || search.includes('code=')) {
          // Supabase will automatically parse or exchange this
          const { data: { session: detectedSession } } = await supabase.auth.getSession();
          if (mounted) {
            setHasValidSession(!!detectedSession);
            setCheckingSession(false);
          }
        } else {
          if (mounted) {
            setHasValidSession(false);
            setCheckingSession(false);
          }
        }
      } catch (err) {
        console.error('[ResetPassword] Session check failed:', err);
        if (mounted) {
          setHasValidSession(false);
          setCheckingSession(false);
        }
      }
    };

    checkRecoverySession();

    // Listen for PASSWORD_RECOVERY auth event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (mounted && (event === 'PASSWORD_RECOVERY' || newSession)) {
        setHasValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [session, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!passwords.newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (passwords.newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Passwords do not match. Please verify your entry.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await updateUserPassword(passwords.newPassword);
      if (updateError) {
        setError(updateError.message || 'Failed to update password. Your recovery link may have expired.');
      } else {
        await signOut();
        setIsSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength helper
  const passLength = passwords.newPassword.length;
  const passwordStrength =
    passLength === 0
      ? null
      : passLength < 8
        ? { label: 'Too short', color: 'text-error', bg: 'bg-error', width: 'w-1/4' }
        : passLength < 12
          ? { label: 'Medium', color: 'text-warning', bg: 'bg-warning', width: 'w-2/3' }
          : { label: 'Strong', color: 'text-success', bg: 'bg-success', width: 'w-full' };

  if (checkingSession) {
    return (
      <Container size="sm">
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-spin mb-4">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <p className="text-secondary text-sm">Verifying reset authorization…</p>
        </div>
      </Container>
    );
  }

  // If no recovery session exists, encourage user to request OTP or go to /forgot-password
  if (!hasValidSession && !isSuccess) {
    return (
      <Container size="sm">
        <div className="py-12 md:py-20 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg mb-8">
            <KeyRound className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>

          <div className="w-full max-w-md glass-panel-elevated rounded-2xl p-8 text-center animate-fade-in-up">
            <h1 className="text-2xl font-bold text-foreground mb-3">Reset Password</h1>
            <p className="text-secondary text-sm mb-6 leading-relaxed">
              To update your password via OTP or recovery email, please request a verification code on the Forgot Password page.
            </p>
            <Button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="w-full"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Go to Forgot Password
            </Button>
            <div className="mt-4">
              <Link to="/login" className="text-xs font-semibold text-secondary hover:text-foreground transition-colors">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container size="sm">
      <div className="py-12 md:py-20 flex flex-col items-center">
        {/* Logo Mark */}
        <div className="mb-8 animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary-hover to-info flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-primary-light/50">
            {isSuccess ? (
              <CheckCircle2 className="h-8 w-8 text-white animate-scale-in" strokeWidth={2.5} />
            ) : (
              <ShieldCheck className="h-8 w-8 text-white" strokeWidth={2.2} />
            )}
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-md glass-panel-elevated rounded-2xl p-8 animate-fade-in-up stagger-1">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {isSuccess ? 'Password Reset Complete' : 'Set New Password'}
            </h1>
            <p className="mt-2 text-secondary text-sm leading-relaxed">
              {isSuccess
                ? 'Your password has been reset successfully. Please sign in with your new credentials.'
                : 'Create a new, strong password for your DiagnoVision account.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-error-bg border border-error-light text-sm text-error animate-scale-in" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-6 text-center animate-scale-in">
              <div className="p-4 rounded-xl bg-success-bg border border-success-light text-success text-sm leading-relaxed">
                <p className="font-semibold mb-1">Password Changed</p>
                You can now log in using your updated password.
              </div>
              <Button
                type="button"
                onClick={() => navigate('/login?reset=success', { replace: true })}
                className="w-full"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Sign In Now
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* New Password */}
              <div>
                <label htmlFor="new-pass" className="block text-sm font-medium text-foreground mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="new-pass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    placeholder="At least 8 characters"
                    className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-secondary transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {passwordStrength && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                      <div className={`h-full ${passwordStrength.bg} ${passwordStrength.width} transition-all duration-300 rounded-full`} />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Password strength:</span>
                      <span className={`font-semibold ${passwordStrength.color}`}>{passwordStrength.label}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirm-new-pass" className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="confirm-new-pass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    placeholder="Repeat new password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-secondary transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwords.confirmPassword && (
                  <p className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${
                    passwords.newPassword === passwords.confirmPassword ? 'text-success' : 'text-error'
                  }`}>
                    {passwords.newPassword === passwords.confirmPassword ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Passwords match
                      </>
                    ) : (
                      'Passwords do not match'
                    )}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full"
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                Save New Password
              </Button>
            </form>
          )}
        </div>
      </div>
    </Container>
  );
}
