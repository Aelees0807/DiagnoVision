import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  KeyRound, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, 
  ArrowRight, CheckCircle2, ShieldCheck, RefreshCw 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot Password');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const { resetPasswordForEmail, verifyResetOtp, updateUserPassword, signOut } = useAuth();

  // Wizard steps: 'email' (step 1) -> 'otp_and_password' (step 2) -> 'success' (step 3)
  const [step, setStep] = useState(initialEmail ? 'otp_and_password' : 'email');
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']); // Fixed 8-digit OTP
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  const otpInputsRef = useRef([]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Step 1: Request OTP email
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: resetError } = await resetPasswordForEmail({ email: trimmedEmail });
      if (resetError) {
        if (resetError.message?.toLowerCase().includes('rate limit')) {
          setError('Too many requests. Please wait a few minutes before requesting another code.');
        } else {
          setError(resetError.message || 'Failed to send verification code. Please try again.');
        }
      } else {
        setStep('otp_and_password');
        setInfoMessage(`We've sent an 8-digit verification code to ${trimmedEmail}.`);
        setCountdown(60); // 60s cooldown
      }
    } catch {
      setError('An unexpected error occurred while requesting your reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || isResending) return;
    setError('');
    setInfoMessage('');
    setIsResending(true);

    try {
      const { error: resendError } = await resetPasswordForEmail({ email: email.trim().toLowerCase() });
      if (resendError) {
        setError(resendError.message || 'Failed to resend code. Please try again.');
      } else {
        setInfoMessage('A fresh 8-digit verification code has been dispatched to your email.');
        setCountdown(60);
      }
    } catch {
      setError('Could not resend verification code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // 8-digit OTP input handlers
  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/[^a-zA-Z0-9]/g, '');
    const newOtp = [...otp];

    if (!cleanVal) {
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    newOtp[index] = cleanVal.slice(-1);
    setOtp(newOtp);

    // Auto-advance to next box
    if (index < 7) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 7) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!paste) return;

    const newOtp = ['', '', '', '', '', '', '', ''];
    for (let i = 0; i < 8; i++) {
      if (i < paste.length) {
        newOtp[i] = paste[i];
      }
    }
    setOtp(newOtp);

    const focusIdx = Math.min(paste.length, 7);
    otpInputsRef.current[focusIdx]?.focus();
  };

  // Step 2: Verify OTP and update password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const token = otp.join('').trim();
    if (!token || token.length !== 8) {
      setError('Please enter the complete 8-digit verification code.');
      return;
    }

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
      // 1. Verify OTP with Supabase Auth
      const { error: verifyError } = await verifyResetOtp({
        email: email.trim().toLowerCase(),
        token,
      });

      if (verifyError) {
        if (verifyError.message?.toLowerCase().includes('expired')) {
          setError('Verification code has expired. Please request a new code below.');
        } else if (verifyError.message?.toLowerCase().includes('invalid')) {
          setError('Invalid 8-digit verification code. Please check your email and try again.');
        } else {
          setError(verifyError.message || 'Failed to verify code. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      // 2. Now that the recovery session is active, update the user password
      const { error: updateError } = await updateUserPassword(passwords.newPassword);

      if (updateError) {
        setError(updateError.message || 'Verification succeeded, but failed to update password. Please try again.');
        setIsLoading(false);
        return;
      }

      // 3. Clear temporary recovery session so user signs in cleanly with new password
      await signOut();
      setStep('success');
    } catch {
      setError('An unexpected error occurred while resetting your password. Please try again.');
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

  return (
    <Container size="sm">
      <div className="py-12 md:py-20 flex flex-col items-center">
        {/* Logo / Security Icon Badge */}
        <div className="mb-8 animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary-hover to-info flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-primary-light/50">
            {step === 'success' ? (
              <CheckCircle2 className="h-8 w-8 text-white animate-scale-in" strokeWidth={2.5} />
            ) : (
              <KeyRound className="h-8 w-8 text-white animate-pulse" strokeWidth={2.2} />
            )}
          </div>
        </div>

        {/* Glass Card */}
        <div className="w-full max-w-md glass-panel-elevated rounded-2xl p-8 animate-fade-in-up stagger-1">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {step === 'email' && 'Forgot Password'}
              {step === 'otp_and_password' && 'Enter Verification Code'}
              {step === 'success' && 'Password Updated!'}
            </h1>
            <p className="mt-2 text-secondary text-sm leading-relaxed">
              {step === 'email' && 'Enter your registered email address and we will send you an 8-digit OTP to reset your password.'}
              {step === 'otp_and_password' && (
                <>
                  We sent an 8-digit code to <span className="font-semibold text-foreground">{email}</span>.
                  {' '}
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setError(''); setInfoMessage(''); }}
                    className="text-primary hover:text-primary-hover font-semibold underline underline-offset-2 ml-1"
                  >
                    Change
                  </button>
                </>
              )}
              {step === 'success' && 'Your password has been changed successfully. You can now sign in with your new credentials.'}
            </p>
          </div>

          {/* Info Banner */}
          {infoMessage && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-info-bg border border-info-light text-sm text-info animate-scale-in" role="status">
              <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 text-info" />
              <p>{infoMessage}</p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-error-bg border border-error-light text-sm text-error animate-scale-in" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 1: Request OTP via Email
              ══════════════════════════════════════════════════════ */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-5" noValidate>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@hospital.org"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                  />
                </div>
              </div>

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Send Verification Code
              </Button>

              <div className="pt-4 border-t border-border/60 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 2: Enter 8-Digit OTP + New Password
              ══════════════════════════════════════════════════════ */}
          {step === 'otp_and_password' && (
            <form onSubmit={handleResetPassword} className="space-y-6" noValidate>
              {/* 8-Digit OTP Boxes */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2 text-center">
                  8-Digit Verification Code (OTP)
                </label>

                <div 
                  className="grid grid-cols-8 gap-1 sm:gap-1.5 justify-center max-w-[360px] mx-auto"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[a-zA-Z0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className="w-9 h-12 sm:w-10 sm:h-13 text-center text-xl sm:text-2xl font-bold font-mono text-primary rounded-xl border-2 border-border bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-150"
                    />
                  ))}
                </div>

                {/* Resend OTP button */}
                <div className="mt-3 flex items-center justify-between text-xs text-secondary px-1">
                  <span>Didn&apos;t get the code?</span>
                  {countdown > 0 ? (
                    <span className="text-muted font-medium">Resend in {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending}
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-hover transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${isResending ? 'animate-spin' : ''}`} />
                      Resend Code
                    </button>
                  )}
                </div>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="reset-new-password" className="block text-sm font-medium text-foreground mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="reset-new-password"
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

                {/* Strength Meter */}
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
                <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="reset-confirm-password"
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
                Update Password
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  className="text-xs font-semibold text-secondary hover:text-foreground transition-colors"
                >
                  ← Use a different email
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════
              STEP 3: Success Screen
              ══════════════════════════════════════════════════════ */}
          {step === 'success' && (
            <div className="space-y-6 text-center animate-scale-in">
              <div className="p-4 rounded-xl bg-success-bg border border-success-light text-success text-sm leading-relaxed">
                <p className="font-semibold mb-1">Success!</p>
                Your password has been securely updated. You can now sign in with your new password.
              </div>

              <Button
                type="button"
                onClick={() => navigate('/login?reset=success', { replace: true })}
                className="w-full"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Sign In With New Password
              </Button>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
