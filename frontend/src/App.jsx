import { Suspense, lazy, useState, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import { Spinner } from './components/ui/Spinner.jsx';

// Lazy load pages for better performance (route-based code splitting)
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const PredictPage = lazy(() => import('./pages/PredictPage.jsx'));
const ResultPage = lazy(() => import('./pages/ResultPage.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

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
  const [showSplash, setShowSplash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only show splash screen once per session
    const splashSeen = sessionStorage.getItem('diagnovision_splash_seen');
    if (!splashSeen) {
      setShowSplash(true);
      sessionStorage.setItem('diagnovision_splash_seen', 'true');
      
      // Fallback timeout in case video onEnded doesn't fire
      const timer = setTimeout(() => {
        handleSplashEnd();
      }, 8000); // adjust based on video length
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSplashEnd = () => {
    setFadeOut(true);
    setTimeout(() => {
      setShowSplash(false);
    }, 800); // match fade out duration
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      {showSplash && (
        <div 
          className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-700 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
        >
          <video 
            src="/intro.mp4" 
            autoPlay 
            muted 
            playsInline
            className="w-full h-full object-cover"
            onEnded={handleSplashEnd}
          />
        </div>
      )}

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
              <Route path="/" element={<LandingPage />} />
              <Route path="/predict" element={<PredictPage />} />
              <Route path="/result" element={<ResultPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
