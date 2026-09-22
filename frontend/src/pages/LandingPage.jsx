import { Link } from 'react-router-dom';
import {
  ArrowRight, Shield, Brain, Eye, Scan, Activity,
  CheckCircle, Upload, Cpu, FileCheck, Stethoscope,
  BarChart3, Layers, Zap, HeartPulse,
} from 'lucide-react';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import MetricCard from '@/components/metrics/MetricCard';
import MedicalDisclaimer from '@/components/prediction/MedicalDisclaimer';
import RevealSection from '@/components/ui/RevealSection';
import ParticleField from '@/components/ui/ParticleField';
import { MODEL_METRICS, PNEUMONIA_MODEL, DATASET_INFO } from '@/constants';
import { formatPercent } from '@/utils/formatting';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function LandingPage() {
  useDocumentTitle('Home');
  return (
    <>
      {/* ═══════════════════════════════════════════════
          HERO SECTION — Primary entry point
          ═══════════════════════════════════════════════ */}
      <section className="relative py-20 md:py-32 lg:py-40 overflow-hidden">
        {/* Particle background for depth */}
        <ParticleField count={40} />

        {/* Floating decorative orbs */}
        <div className="absolute top-16 right-[8%] w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" aria-hidden="true" />
        <div className="absolute bottom-10 left-[5%] w-56 h-56 bg-info/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} aria-hidden="true" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/3 to-transparent rounded-full blur-3xl" aria-hidden="true" />

        <Container size="xl">
          <div className="max-w-3xl mx-auto text-center relative">
            {/* Status pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-primary/20 text-sm font-medium text-primary mb-6 animate-fade-in-up">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              AI-Assisted Pneumonia Screening
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.08] animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
              <span className="text-foreground">Analyze Chest X-Rays with </span>
              <span className="gradient-text">Deep Learning</span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-secondary max-w-2xl mx-auto leading-relaxed animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
              Upload a pediatric chest X-ray for instant AI analysis. DiagnoVision uses
              an {PNEUMONIA_MODEL.name} model with a gatekeeper system and
              Grad-CAM explainability to provide transparent screening results.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
              <Link to="/predict">
                <Button size="lg" icon={<Scan className="h-5 w-5" />}>
                  Analyze X-Ray
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link to="/model">
                <Button variant="secondary" size="lg" icon={<Brain className="h-5 w-5" />}>
                  View Model Details
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-muted animate-fade-in-up stagger-4" style={{ opacity: 0 }}>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-success" />
                Open Source
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Image Validation
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-info" />
                Explainable AI
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════
          PRODUCT INTRODUCTION — What DiagnoVision is
          ═══════════════════════════════════════════════ */}
      <section className="py-16 md:py-24">
        <Container size="xl">
          <RevealSection>
            <div className="relative rounded-2xl glass-strong border border-border/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-info/[0.02]" />
              <div className="relative p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light text-primary text-xs font-semibold mb-4">
                    <HeartPulse className="h-3.5 w-3.5" />
                    About This Project
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                    AI-Powered Screening for Pediatric Pneumonia
                  </h2>
                  <p className="text-secondary leading-relaxed">
                    Pneumonia is a leading cause of death in children under five worldwide.
                    Manual chest X-ray interpretation is time-consuming, subject to
                    inter-observer variability, and dependent on specialist availability.
                  </p>
                  <p className="text-secondary leading-relaxed mt-4">
                    DiagnoVision provides a fast, consistent AI-assisted screening layer
                    that can flag probable pneumonia cases for clinical follow-up — using
                    transfer learning, input validation, and visual explainability.
                  </p>
                </div>

                {/* Visual representation */}
                <div className="relative flex items-center justify-center">
                  <div className="relative w-full max-w-xs mx-auto">
                    {/* 3D-inspired stacked cards */}
                    <div className="absolute -top-3 -left-3 w-full h-full rounded-2xl bg-primary/5 border border-primary/10 transform rotate-3" />
                    <div className="absolute -top-1.5 -left-1.5 w-full h-full rounded-2xl bg-info/5 border border-info/10 transform rotate-1.5" />
                    <div className="relative rounded-2xl bg-white border border-border p-6 shadow-lg">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center">
                            <Stethoscope className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-muted">AI Screening Tool</p>
                            <p className="text-sm font-semibold text-foreground">DiagnoVision v1.0</p>
                          </div>
                        </div>
                        <div className="h-px bg-border" />
                        <div className="space-y-2.5 text-xs text-secondary">
                          <div className="flex items-center justify-between">
                            <span>Classification Model</span>
                            <span className="font-mono font-medium text-foreground">{PNEUMONIA_MODEL.name}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Input Resolution</span>
                            <span className="font-mono font-medium text-foreground">{PNEUMONIA_MODEL.input_size} RGB</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Training Images</span>
                            <span className="font-mono font-medium text-foreground">{DATASET_INFO.totalImages.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Test Accuracy</span>
                            <span className="font-mono font-medium text-primary">{formatPercent(MODEL_METRICS.accuracy)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RevealSection>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════
          FEATURES — AI Screening, Gatekeeper, Grad-CAM
          ═══════════════════════════════════════════════ */}
      <section className="py-16 md:py-24">
        <Container size="xl">
          <RevealSection>
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                How DiagnoVision Works
              </h2>
              <p className="mt-3 text-secondary max-w-xl mx-auto">
                A multi-stage pipeline combining image validation, deep learning classification,
                and visual explainability.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: Gatekeeper */}
            <RevealSection delay={0}>
              <div className="group relative h-full bg-white/70 backdrop-blur-sm border border-border rounded-2xl p-6 card-float overflow-hidden">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-success/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-bg to-success-light flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <Shield className="h-6 w-6 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Gatekeeper Validation</h3>
                  <p className="text-sm text-secondary leading-relaxed">
                    A MobileNetV3-Small model first verifies that the uploaded image is a
                    valid frontal chest X-ray, preventing inaccurate predictions on
                    irrelevant images.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-success font-medium">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Pre-prediction safety check
                  </div>
                </div>
              </div>
            </RevealSection>

            {/* Feature 2: AI Screening */}
            <RevealSection delay={150}>
              <div className="group relative h-full bg-white/70 backdrop-blur-sm border border-border rounded-2xl p-6 card-float overflow-hidden">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-light to-info-light flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">AI Pneumonia Screening</h3>
                  <p className="text-sm text-secondary leading-relaxed">
                    An {PNEUMONIA_MODEL.name} deep learning model classifies the X-ray
                    as NORMAL or PNEUMONIA with per-class probability scores, trained on
                    {' '}{DATASET_INFO.totalImages.toLocaleString()} pediatric chest X-ray images.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                    <Zap className="h-3.5 w-3.5" />
                    Transfer learning with ImageNet
                  </div>
                </div>
              </div>
            </RevealSection>

            {/* Feature 3: Grad-CAM */}
            <RevealSection delay={300}>
              <div className="group relative h-full bg-white/70 backdrop-blur-sm border border-border rounded-2xl p-6 card-float overflow-hidden">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-info/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-info/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-info-light to-primary-light flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <Eye className="h-6 w-6 text-info" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Grad-CAM Explainability</h3>
                  <p className="text-sm text-secondary leading-relaxed">
                    Gradient-weighted Class Activation Mapping generates visual heatmaps
                    showing which regions of the X-ray the model focused on, providing
                    transparency into AI decision-making.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-info font-medium">
                    <Layers className="h-3.5 w-3.5" />
                    Layer-level attention mapping
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════
          PREDICTION PIPELINE — Detailed flow
          ═══════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        {/* Subtle background accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-light/20 to-transparent" aria-hidden="true" />

        <Container size="xl">
          <RevealSection>
            <div className="text-center mb-4">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                The Prediction Pipeline
              </h2>
              <p className="mt-3 text-secondary max-w-lg mx-auto">
                Every uploaded image passes through a multi-stage validation and analysis pipeline.
              </p>
            </div>
          </RevealSection>

          <div className="mt-12 max-w-4xl mx-auto">
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/0 via-primary/20 to-primary/0 hidden md:block" aria-hidden="true" />

              {/* Step 1 */}
              <RevealSection delay={0}>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-10 md:mb-12">
                  <div className="flex-1 md:text-right md:pr-8 order-2 md:order-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">Image Upload</h3>
                    <p className="text-sm text-secondary leading-relaxed">
                      Upload a chest X-ray image via drag-and-drop or file browser.
                      Client-side validation checks file type (JPEG, PNG, BMP) and
                      size (≤10 MB).
                    </p>
                  </div>
                  <div className="relative z-10 shrink-0 order-1 md:order-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-hover shadow-lg shadow-primary/20 flex items-center justify-center">
                      <Upload className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 md:pl-8 order-3 hidden md:block" />
                </div>
              </RevealSection>

              {/* Step 2 */}
              <RevealSection delay={150}>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-10 md:mb-12">
                  <div className="flex-1 md:text-right md:pr-8 order-2 md:order-1 hidden md:block" />
                  <div className="relative z-10 shrink-0 order-1 md:order-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-success to-success/80 shadow-lg shadow-success/20 flex items-center justify-center">
                      <Shield className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 md:pl-8 order-2 md:order-3">
                    <h3 className="text-lg font-semibold text-foreground mb-1">Gatekeeper Check</h3>
                    <p className="text-sm text-secondary leading-relaxed">
                      The MobileNetV3-Small gatekeeper model verifies the image
                      is a frontal chest X-ray. Non-X-ray images are rejected before
                      prediction to prevent inaccurate results.
                    </p>
                  </div>
                </div>
              </RevealSection>

              {/* Step 3 */}
              <RevealSection delay={300}>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-10 md:mb-12">
                  <div className="flex-1 md:text-right md:pr-8 order-2 md:order-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">Pneumonia Classification</h3>
                    <p className="text-sm text-secondary leading-relaxed">
                      The {PNEUMONIA_MODEL.name} model analyzes the validated X-ray and
                      produces classification probabilities for NORMAL and PNEUMONIA
                      classes using softmax output.
                    </p>
                  </div>
                  <div className="relative z-10 shrink-0 order-1 md:order-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-info to-primary shadow-lg shadow-info/20 flex items-center justify-center">
                      <Brain className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 md:pl-8 order-3 hidden md:block" />
                </div>
              </RevealSection>

              {/* Step 4 */}
              <RevealSection delay={450}>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="flex-1 md:text-right md:pr-8 order-2 md:order-1 hidden md:block" />
                  <div className="relative z-10 shrink-0 order-1 md:order-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-info shadow-lg shadow-primary/20 flex items-center justify-center">
                      <Eye className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 md:pl-8 order-2 md:order-3">
                    <h3 className="text-lg font-semibold text-foreground mb-1">Grad-CAM Visualization</h3>
                    <p className="text-sm text-secondary leading-relaxed">
                      A Grad-CAM heatmap is generated from the final convolutional layer,
                      highlighting which image regions influenced the model's prediction
                      — enabling clinical plausibility assessment.
                    </p>
                  </div>
                </div>
              </RevealSection>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════
          WORKFLOW STEPS — User-facing flow
          ═══════════════════════════════════════════════ */}
      <section className="py-16 md:py-24">
        <Container size="xl">
          <RevealSection>
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                Simple 3-Step Workflow
              </h2>
              <p className="mt-3 text-secondary max-w-md mx-auto">
                From upload to result in seconds — designed for simplicity.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: 1, icon: Upload, title: 'Upload', desc: 'Drag & drop or browse to select a chest X-ray image (JPEG, PNG, or BMP).' },
              { step: 2, icon: Cpu, title: 'Analyze', desc: 'The AI pipeline validates the image and runs pneumonia classification automatically.' },
              { step: 3, icon: FileCheck, title: 'Review', desc: 'View the prediction, confidence scores, probability breakdown, and Grad-CAM visualization.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <RevealSection key={step} delay={(step - 1) * 150}>
                <div className="relative text-center group">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-white text-xl font-bold mb-4 shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                    {step}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{desc}</p>

                  {/* Connector line */}
                  {step < 3 && (
                    <div className="hidden md:block absolute top-8 left-[calc(50%+44px)] w-[calc(100%-88px)] h-px" aria-hidden="true">
                      <div className="w-full h-full bg-gradient-to-r from-primary/30 to-primary/10" />
                      {/* Animated dot */}
                      <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" style={{ left: '50%' }} />
                    </div>
                  )}
                </div>
              </RevealSection>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════
          MODEL PERFORMANCE — Key statistics
          ═══════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-info-light/10 to-transparent" aria-hidden="true" />

        <Container size="xl">
          <RevealSection>
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                Model Performance
              </h2>
              <p className="mt-3 text-secondary max-w-xl mx-auto">
                Evaluated on a held-out test set of {MODEL_METRICS.test_set_size} images.
                All metrics are from the repository&apos;s evaluation results.
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <MetricCard
              label="Test Accuracy"
              value={formatPercent(MODEL_METRICS.accuracy)}
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <MetricCard
              label="Sensitivity"
              value={formatPercent(MODEL_METRICS.sensitivity)}
              description="Pneumonia detection rate"
            />
            <MetricCard
              label="Specificity"
              value={formatPercent(MODEL_METRICS.specificity)}
              description="Normal identification rate"
            />
            <MetricCard
              label="F1 (Pneumonia)"
              value={formatPercent(MODEL_METRICS.f1_pneumonia)}
              description="Harmonic mean precision/recall"
            />
          </div>

          <RevealSection delay={200}>
            <div className="text-center mt-8">
              <Link to="/model">
                <Button variant="outline" icon={<BarChart3 className="h-4 w-4" />}>
                  View Full Model Details
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </RevealSection>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════
          CTA — Final call to action
          ═══════════════════════════════════════════════ */}
      <section className="py-16 md:py-24">
        <Container size="md">
          <RevealSection direction="scale">
            <div className="relative rounded-2xl overflow-hidden">
              {/* Gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-hover to-primary-active" />
              {/* Grid pattern overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" aria-hidden="true" />
              {/* Floating glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl" aria-hidden="true" />

              <div className="relative px-8 py-12 md:py-16 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  Ready to Analyze an X-Ray?
                </h2>
                <p className="text-white/80 max-w-md mx-auto mb-8">
                  Upload a pediatric chest X-ray image and receive an AI screening result
                  with visual explanations in seconds.
                </p>
                <Link to="/predict">
                  <Button
                    size="lg"
                    className="bg-white text-primary hover:bg-white/90 shadow-lg hover:shadow-xl transition-all duration-300"
                    icon={<Scan className="h-5 w-5" />}
                  >
                    Start Analysis
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </RevealSection>

          {/* ═══════════════════════════════════════════════
              MEDICAL DISCLAIMER — Required on landing
              ═══════════════════════════════════════════════ */}
          <RevealSection delay={200}>
            <div className="mt-8">
              <MedicalDisclaimer variant="full" />
            </div>
          </RevealSection>
        </Container>
      </section>
    </>
  );
}
