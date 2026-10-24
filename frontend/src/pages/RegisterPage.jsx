import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, Eye, EyeOff, User, AlertCircle, CheckCircle, Activity, Stethoscope, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';

const ROLE_OPTIONS = [
  {
    value: 'general',
    label: 'General User',
    description: 'View and save your AI-assisted screening results.',
    icon: Users,
  },
  {
    value: 'medical_staff',
    label: 'Medical Staff',
    description: 'Access additional clinical context and screening tools.',
    icon: Stethoscope,
  },
];

/**
 * Register page — full name, email, password, confirm password, role picker.
 * Validates min 8 chars, matching passwords.
 * admin role is NOT selectable from the UI.
 */
export default function RegisterPage() {
  useDocumentTitle('Create Account');
  const { signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'general',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const updateField = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setError('');
  };

  const validate = () => {
    if (!formData.fullName.trim()) {
      return 'Please enter your full name.';
    }
    if (formData.fullName.trim().length < 2) {
      return 'Full name must be at least 2 characters.';
    }
    if (!formData.email.trim()) {
      return 'Please enter your email address.';
    }
    // Simple email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!formData.password) {
      return 'Please enter a password.';
    }
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await signUp({
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        role: formData.role,
      });

      if (signUpError) {
        if (signUpError.message?.includes('already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(signUpError.message || 'An error occurred during registration.');
        }
      } else if (data?.user?.identities?.length === 0) {
        // Supabase returns an empty identities array if the user already exists
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        // Check if email confirmation is required
        if (data?.session) {
          // Auto-confirmed — redirect to home
          navigate('/', { replace: true });
        } else {
          // Email confirmation required — go to OTP screen
          navigate(`/verify-email?email=${encodeURIComponent(formData.email.trim())}`);
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const passwordLength = formData.password.length;
  const passwordStrength =
    passwordLength === 0
      ? null
      : passwordLength < 8
        ? { label: 'Too short', color: 'text-error', bg: 'bg-error' }
        : passwordLength < 12
          ? { label: 'Good', color: 'text-warning', bg: 'bg-warning' }
          : { label: 'Strong', color: 'text-success', bg: 'bg-success' };

  return (
    <Container size="sm">
      <div className="py-12 md:py-16 flex flex-col items-center">
        {/* Logo mark */}
        <div className="mb-8 animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg">
            <Activity className="h-7 w-7 text-white" strokeWidth={2.5} />
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-md glass-panel-elevated rounded-2xl p-8 animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Create Account
            </h1>
            <p className="mt-2 text-secondary text-sm">
              Sign up to save your AI-assisted screening results and access your history.
            </p>
          </div>

          {/* Success message */}
          {success && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-success-bg border border-success-light text-sm text-success animate-scale-in" role="status">
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p>{success}</p>
                <Link to="/login" className="mt-2 inline-block font-semibold text-primary hover:text-primary-hover transition-colors">
                  Go to Sign In →
                </Link>
              </div>
            </div>
          )}

          {/* Error alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-error-bg border border-error-light text-sm text-error animate-scale-in" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Form (hide when success is shown) */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Full Name */}
              <div>
                <label htmlFor="register-name" className="block text-sm font-medium text-foreground mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={formData.fullName}
                    onChange={updateField('fullName')}
                    placeholder="Dr. Jane Smith"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="register-email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={updateField('email')}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="register-password" className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={updateField('password')}
                    placeholder="Min. 8 characters"
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
                {/* Password strength bar */}
                {passwordStrength && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.bg}`}
                        style={{ width: passwordLength < 8 ? '33%' : passwordLength < 12 ? '66%' : '100%' }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="register-confirm" className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted" />
                  </div>
                  <input
                    id="register-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={updateField('confirmPassword')}
                    placeholder="Re-enter your password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-secondary transition-colors"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Match indicator */}
                {formData.confirmPassword && (
                  <p className={`mt-1.5 text-xs font-medium ${formData.password === formData.confirmPassword ? 'text-success' : 'text-error'}`}>
                    {formData.password === formData.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              {/* Role picker */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, role: value }))}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                        formData.role === value
                          ? 'border-primary bg-primary-light shadow-sm'
                          : 'border-border bg-white hover:border-muted hover:bg-surface-hover'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1.5 ${formData.role === value ? 'text-primary' : 'text-muted'}`} />
                      <p className={`text-sm font-semibold ${formData.role === value ? 'text-primary' : 'text-foreground'}`}>
                        {label}
                      </p>
                      <p className="text-xs text-secondary mt-0.5 leading-snug">
                        {description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full"
                icon={<UserPlus className="h-4 w-4" />}
              >
                Create Account
              </Button>
            </form>
          )}

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:text-primary-hover transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </Container>
  );
}
