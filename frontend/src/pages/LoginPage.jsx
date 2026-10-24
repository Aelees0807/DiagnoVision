import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, Activity, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Login page — email + password sign-in.
 * Uses the app's existing Tailwind patterns and glass-panel styling.
 * Redirects to the return path (from ProtectedRoute) or / after login.
 */
export default function LoginPage() {
  useDocumentTitle('Sign In');
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'success';

  // Where to go after login (set by ProtectedRoute)
  const from = location.state?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect
  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError(
        'Deployment Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing in your deployment platform settings. Please add them to your environment variables and redeploy.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await signIn({ email: email.trim(), password });

      if (signInError) {
        // Supabase returns various error messages; map common ones
        if (signInError.message?.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (signInError.message?.includes('Email not confirmed')) {
          navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        } else if (
          signInError.message?.includes('Failed to fetch') ||
          signInError.message?.includes('NetworkError') ||
          signInError.name === 'TypeError'
        ) {
          setError(
            'Unable to connect to Supabase (Failed to fetch). Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in your deployment environment variables.'
          );
        } else {
          setError(signInError.message || 'An error occurred during sign in.');
        }
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      if (err?.message?.includes('Failed to fetch')) {
        setError(
          'Unable to connect to Supabase (Failed to fetch). Please verify your live deployment has VITE_SUPABASE_URL set.'
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
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
            <Activity className="h-7 w-7 text-white" strokeWidth={2.5} />
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-md glass-panel-elevated rounded-2xl p-8 animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Welcome Back
            </h1>
            <p className="mt-2 text-secondary text-sm">
              Sign in to access your screening history and saved results.
            </p>
          </div>

          {/* Success alert */}
          {resetSuccess && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-success-bg border border-success-light text-sm text-success animate-scale-in" role="alert">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-success" />
              <p>Your password has been reset successfully! Please sign in with your new password.</p>
            </div>
          )}

          {/* Error alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-error-bg border border-error-light text-sm text-error animate-scale-in" role="alert">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email field */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-foreground mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-muted" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
            </div>

            {/* Submit */}
            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full"
              icon={<LogIn className="h-4 w-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-secondary">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-primary hover:text-primary-hover transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </Container>
  );
}
