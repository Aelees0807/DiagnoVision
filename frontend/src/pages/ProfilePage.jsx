import { useState } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/lib/supabase';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';

/**
 * Profile page — edit full name, change password.
 * Accessible at /profile behind ProtectedRoute.
 */
export default function ProfilePage() {
  useDocumentTitle('My Profile');
  const { profile, user, refreshProfile } = useAuth();

  // ── Edit Name ──
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError, setNameError] = useState('');

  // ── Change Password ──
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');

    if (!fullName.trim()) {
      setNameError('Name cannot be empty.');
      return;
    }
    if (fullName.trim().length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }

    setNameLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);

      if (error) {
        setNameError(error.message || 'Failed to update name.');
      } else {
        setNameSuccess('Name updated successfully.');
        await refreshProfile();
      }
    } catch {
      setNameError('An unexpected error occurred.');
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!passwords.newPassword) {
      setPassError('Please enter a new password.');
      return;
    }
    if (passwords.newPassword.length < 8) {
      setPassError('Password must be at least 8 characters long.');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPassError('Passwords do not match.');
      return;
    }

    setPassLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      });

      if (error) {
        setPassError(error.message || 'Failed to change password.');
      } else {
        setPassSuccess('Password changed successfully.');
        setPasswords({ newPassword: '', confirmPassword: '' });
      }
    } catch {
      setPassError('An unexpected error occurred.');
    } finally {
      setPassLoading(false);
    }
  };

  const roleBadge = {
    general: { label: 'General User', style: 'bg-info-bg text-info border-info-light' },
    medical_staff: { label: 'Medical Staff', style: 'bg-success-bg text-success border-success-light' },
    admin: { label: 'Admin', style: 'bg-primary-light text-primary border-primary' },
  };

  const badge = roleBadge[profile?.role] || roleBadge.general;

  return (
    <Container size="sm">
      <PageHeader
        title="My Profile"
        description="Manage your account settings and preferences."
      />

      <div className="space-y-6 pb-12">
        {/* ── Account Info Card ── */}
        <div className="glass-panel-elevated rounded-2xl p-6 animate-fade-in-up">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-sm text-secondary">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.style}`}>
              {badge.label}
            </span>
            <span className="text-xs text-muted">
              Member since {new Date(profile?.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </span>
          </div>
        </div>

        {/* ── Edit Name Card ── */}
        <div className="glass-panel rounded-2xl p-6 animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
          <h2 className="text-lg font-semibold text-foreground mb-4">Edit Name</h2>

          {nameSuccess && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-success-bg border border-success-light text-sm text-success animate-scale-in" role="status">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <p>{nameSuccess}</p>
            </div>
          )}
          {nameError && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-error-bg border border-error-light text-sm text-error animate-scale-in" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{nameError}</p>
            </div>
          )}

          <form onSubmit={handleNameSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-muted" />
              </div>
              <input
                id="profile-name"
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setNameError(''); setNameSuccess(''); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                placeholder="Your full name"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              isLoading={nameLoading}
              icon={<Save className="h-4 w-4" />}
            >
              Save
            </Button>
          </form>
        </div>

        {/* ── Change Password Card ── */}
        <div className="glass-panel rounded-2xl p-6 animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
          <h2 className="text-lg font-semibold text-foreground mb-4">Change Password</h2>

          {passSuccess && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-success-bg border border-success-light text-sm text-success animate-scale-in" role="status">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <p>{passSuccess}</p>
            </div>
          )}
          {passError && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-error-bg border border-error-light text-sm text-error animate-scale-in" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{passError}</p>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
            {/* New Password */}
            <div>
              <label htmlFor="profile-new-password" className="block text-sm font-medium text-foreground mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted" />
                </div>
                <input
                  id="profile-new-password"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwords.newPassword}
                  onChange={(e) => { setPasswords(p => ({ ...p, newPassword: e.target.value })); setPassError(''); setPassSuccess(''); }}
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-border-focus transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-secondary transition-colors"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="profile-confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted" />
                </div>
                <input
                  id="profile-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwords.confirmPassword}
                  onChange={(e) => { setPasswords(p => ({ ...p, confirmPassword: e.target.value })); setPassError(''); setPassSuccess(''); }}
                  placeholder="Re-enter new password"
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
              {passwords.confirmPassword && (
                <p className={`mt-1.5 text-xs font-medium ${passwords.newPassword === passwords.confirmPassword ? 'text-success' : 'text-error'}`}>
                  {passwords.newPassword === passwords.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <Button
              type="submit"
              isLoading={passLoading}
              icon={<Lock className="h-4 w-4" />}
            >
              Change Password
            </Button>
          </form>
        </div>
      </div>
    </Container>
  );
}
