import { Suspense, lazy, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import { Spinner } from './components/ui/Spinner.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ProtectedRoute, AdminRoute } from './components/auth/ProtectedRoute.jsx';
import { MedicalStaffRoute } from './components/auth/MedicalStaffRoute.jsx';

// Lazy load pages for better performance (route-based code splitting)
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const PredictPage = lazy(() => import('./pages/PredictPage.jsx'));
const ResultPage = lazy(() => import('./pages/ResultPage.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const HistoryPage = lazy(() => import('./pages/HistoryPage.jsx'));

// Medical Staff pages
const StaffDashboardPage = lazy(() => import('./pages/staff/StaffDashboardPage.jsx'));
const PatientManagementPage = lazy(() => import('./pages/staff/PatientManagementPage.jsx'));
const ScanManagementPage = lazy(() => import('./pages/staff/ScanManagementPage.jsx'));
const ScanDetailPage = lazy(() => import('./pages/staff/ScanDetailPage.jsx'));

// Admin pages
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
    <Spinner size="lg" className="text-primary mb-4" />
    <p className="text-secondary font-medium animate-pulse">Loading...</p>
  </div>
);

function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />

        {/* Skip-to-content link for keyboard accessibility */}
        <a 
          href="#main-content" 
          className="fixed top-0 left-0 p-3 bg-primary text-white -translate-y-full focus:translate-y-0 z-[100] transition-transform duration-200"
        >
          Skip to main content
        </a>

        {/* Animated background layers */}
        <div className="bg-animated-gradient" aria-hidden="true" />
        <div className="bg-medical-grid" aria-hidden="true" />

        <div className="relative min-h-screen flex flex-col">
          <Navbar />
          <main id="main-content" className="flex-1 pt-16 flex flex-col">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/predict" element={<PredictPage />} />
                <Route path="/result" element={<ResultPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                
                {/* Protected Routes */}
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />

                {/* Medical Staff Routes */}
                <Route path="/staff" element={<MedicalStaffRoute><StaffDashboardPage /></MedicalStaffRoute>} />
                <Route path="/staff/patients" element={<MedicalStaffRoute><PatientManagementPage /></MedicalStaffRoute>} />
                <Route path="/staff/scans" element={<MedicalStaffRoute><ScanManagementPage /></MedicalStaffRoute>} />
                <Route path="/staff/scans/:id" element={<MedicalStaffRoute><ScanDetailPage /></MedicalStaffRoute>} />

                <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
