import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/Spinner';

/**
 * MedicalStaffRoute — wraps pages that require medical_staff or admin role.
 * Redirects non-staff to the home page, unauthenticated users to /login.
 */
export function MedicalStaffRoute({ children }) {
  const { isAuthenticated, isMedicalStaff, isAdmin, loading, profileLoading } = useAuth();
  const location = useLocation();

  if (loading || (isAuthenticated && profileLoading)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner size="lg" className="text-primary mb-4" />
        <p className="text-secondary font-medium animate-pulse">Verifying clinical credentials…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // If user is an administrator, strictly redirect away from medical staff dashboard/views to admin console
  if (isAdmin) {
    const scanMatch = location.pathname.match(/^\/staff\/scans\/(\d+)$/);
    if (scanMatch) {
      return <Navigate to={`/admin/scans/${scanMatch[1]}`} replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  if (!isMedicalStaff) {
    return <Navigate to="/" replace />;
  }

  return children;
}
