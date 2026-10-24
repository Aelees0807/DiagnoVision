import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck, Activity, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';

export default function VerifyEmailPage() {
  useDocumentTitle('Verify Email');
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const navigate = useNavigate();
  const { verifyOtp, isAuthenticated } = useAuth();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef([]);

  // If already logged in, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // If no email in URL, redirect to login
  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true });
    }
  }, [email, navigate]);

  const handleChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value !== '' && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').slice(0, 8).replace(/\D/g, '');
    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        if (i < 8) newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      // Focus last filled input or end
      const focusIndex = Math.min(pastedData.length, 7);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = otp.join('');
    
    if (token.length !== 8) {
      setError('Please enter the full 8-digit code.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const { error: verifyError } = await verifyOtp({ email, token });
      
      if (verifyError) {
        setError(verifyError.message || 'Invalid or expired code. Please try again.');
      } else {
        // Success! The AuthContext will pick up the new session and redirect
        navigate('/', { replace: true });
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container size="sm">
      <div className="py-12 md:py-20 flex flex-col items-center">
        {/* Logo mark */}
        <div className="mb-8 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg">
            <ShieldCheck className="h-7 w-7 text-white" strokeWidth={2.5} />
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-md glass-panel-elevated rounded-2xl p-8 animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Verify your email
            </h1>
            <p className="mt-3 text-secondary text-sm leading-relaxed">
              We sent an 8-digit verification code to<br/>
              <span className="font-semibold text-foreground">{email}</span>
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-error-bg border border-error-light text-sm text-error animate-scale-in" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* OTP Inputs */}
            <div className="flex justify-between gap-1.5" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-10 h-12 sm:w-11 sm:h-14 text-center text-xl sm:text-2xl font-bold text-primary rounded-xl border-2 border-border bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  required
                />
              ))}
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Verify Account
            </Button>
          </form>

          {/* Resend / Switch Email */}
          <div className="mt-8 pt-6 border-t border-border/60 text-center space-y-3">
            <p className="text-sm text-secondary">
              Didn't receive the email? Check your spam folder or wait a few minutes.
            </p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition-colors">
              <Mail className="h-4 w-4" />
              Use a different email
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
}
