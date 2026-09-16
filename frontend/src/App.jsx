import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import LandingPage from './pages/LandingPage.jsx';
import PredictPage from './pages/PredictPage.jsx';
import ResultPage from './pages/ResultPage.jsx';
import ModelInfoPage from './pages/ModelInfoPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      {/* Animated background layers */}
      <div className="bg-animated-gradient" aria-hidden="true" />
      <div className="bg-medical-grid" aria-hidden="true" />

      <div className="relative min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-16">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/predict" element={<PredictPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/model" element={<ModelInfoPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
