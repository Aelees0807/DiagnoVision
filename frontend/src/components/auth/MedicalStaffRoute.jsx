import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';

/**
 * MedicalStaffRoute — wraps pages that require medical_staff or admin role.
 * Redirects non-staff to the home page, unauthenticated users to /login.
 */
export function MedicalStaffRoute({ children }) {
  const { isAuthenticated, isMedicalStaff, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner size="lg" className="text-primary mb-4" />
        <p className="text-secondary font-medium animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isMedicalStaff && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
