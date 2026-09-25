import {
  ExternalLink, Brain, Database, Code2,
  BookOpen, HeartPulse, Sparkles, Shield, Eye,
  Stethoscope, GraduationCap, FileText,
} from 'lucide-react';
import GithubIcon from '@/components/ui/GithubIcon';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import RevealSection from '@/components/ui/RevealSection';
import MedicalDisclaimer from '@/components/prediction/MedicalDisclaimer';
import { PNEUMONIA_MODEL, DATASET_INFO } from '@/constants';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function AboutPage() {
  useDocumentTitle('About');
  return (
    <Container size="lg">
      <PageHeader
        title="About DiagnoVision"
        description="An academic research project exploring deep learning for automated pneumonia screening from pediatric chest X-rays."
      />

      {/* ─── Project Overview ─── */}
      <section className="mb-12">
        <RevealSection>
          <Card variant="glass" hover className="overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-info to-primary" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg shadow-primary/15">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <CardTitle>Project Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-secondary leading-relaxed">
                DiagnoVision is an AI-powered screening tool that assists in detecting pneumonia
                from pediatric chest X-ray images. The project combines a gatekeeper model for
                image validation, an {PNEUMONIA_MODEL.name} classifier for pneumonia detection,
                and Grad-CAM visualization for model interpretability.
              </p>
              <p className="text-secondary leading-relaxed mt-4">
                This tool is designed for educational and research purposes. It demonstrates
                the application of transfer learning and explainable AI techniques to medical
                image analysis.
              </p>
            </CardContent>
          </Card>
        </RevealSection>
      </section>

      {/* ─── Problem Context ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            Why Pneumonia Screening Matters
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Stethoscope,
                title: 'Clinical Need',
                text: 'Pneumonia kills approximately 800,000 children under five every year (WHO). Early detection through chest X-ray screening is critical.',
                color: 'from-error/10 to-error/5',
                iconColor: 'text-error',
              },
              {
                icon: GraduationCap,
                title: 'Specialist Shortage',
                text: 'Radiologist shortages in low- and middle-income countries limit screening capacity. AI can provide a rapid second opinion.',
                color: 'from-warning/10 to-warning/5',
                iconColor: 'text-warning',
              },
              {
                icon: Sparkles,
                title: 'AI Assistance',
                text: 'DiagnoVision provides a fast, consistent AI-assisted screening layer that flags probable pneumonia cases for clinical follow-up.',
                color: 'from-primary/10 to-primary/5',
                iconColor: 'text-primary',
              },
            ].map(({ icon: Icon, title, text, color, iconColor }, i) => (
              <RevealSection key={title} delay={i * 100}>
                <Card variant="default" hover className="h-full overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-50`} />
                  <CardContent className="relative py-6">
                    <div className={`w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center mb-3 ${iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                    <p className="text-sm text-secondary leading-relaxed">{text}</p>
                  </CardContent>
                </Card>
              </RevealSection>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* ─── Key Features ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Key Features
          </h2>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Shield,
              title: 'Image Validation',
              desc: 'MobileNetV3-Small gatekeeper rejects non-chest-X-ray images before prediction.',
              badge: 'Safety',
              badgeColor: 'success',
            },
            {
              icon: Brain,
              title: 'Deep Learning Classification',
              desc: 'EfficientNet-B0 with transfer learning provides accurate pneumonia screening.',
              badge: 'Core',
              badgeColor: 'info',
            },
            {
              icon: Eye,
              title: 'Explainable AI',
              desc: 'Grad-CAM heatmaps show which X-ray regions the model focused on.',
              badge: 'Transparency',
              badgeColor: 'info',
            },
          ].map(({ icon: Icon, title, desc, badge, badgeColor }, i) => {
            const badgeClasses = {
              success: 'bg-success-bg text-success border-success-light',
              info: 'bg-info-bg text-info border-info-light',
            };
            return (
              <RevealSection key={title} delay={i * 100}>
                <div className="group relative h-full bg-white/70 backdrop-blur-sm border border-border rounded-xl p-5 card-float overflow-hidden">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeClasses[badgeColor]}`}>
                        {badge}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1.5">{title}</h3>
                    <p className="text-sm text-secondary leading-relaxed">{desc}</p>
                  </div>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </section>

      {/* ─── Technology Stack ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Technology Stack
          </h2>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Backend/ML */}
          <RevealSection delay={0}>
            <Card variant="default" hover className="h-full overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <CardHeader>
                <CardTitle as="h3" className="text-lg flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Backend & ML
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-secondary">
                  {[
                    { label: 'Framework', value: 'PyTorch' },
                    { label: 'Pneumonia Model', value: PNEUMONIA_MODEL.name },
                    { label: 'Gatekeeper', value: 'MobileNetV3-Small' },
                    { label: 'Explainability', value: 'Grad-CAM (gradient-weighted class activation)' },
                    { label: 'Training Data', value: `${DATASET_INFO.name} (${DATASET_INFO.totalImages.toLocaleString()} images)` },
                  ].map(({ label, value }) => (
                    <li key={label} className="flex justify-between items-start gap-4 py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted shrink-0">{label}</span>
                      <span className="text-foreground font-medium text-right">{value}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </RevealSection>

          {/* Frontend */}
          <RevealSection delay={150}>
            <Card variant="default" hover className="h-full overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-info/30 to-transparent" />
              <CardHeader>
                <CardTitle as="h3" className="text-lg flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-info" />
                  Frontend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-secondary">
                  {[
                    { label: 'Framework', value: 'React 19' },
                    { label: 'Build Tool', value: 'Vite' },
                    { label: 'Styling', value: 'Tailwind CSS v4' },
                    { label: 'Components', value: 'shadcn/ui patterns' },
                    { label: 'Charts', value: 'Recharts' },
                    { label: 'Icons', value: 'Lucide React' },
                  ].map(({ label, value }) => (
                    <li key={label} className="flex justify-between items-start gap-4 py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted shrink-0">{label}</span>
                      <span className="text-foreground font-medium text-right">{value}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </RevealSection>
        </div>
      </section>

      {/* ─── Repository ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <GithubIcon className="h-5 w-5 text-primary" />
            Source Code
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <Card variant="info" className="overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-info/40 to-transparent" />
            <CardContent className="py-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-info flex items-center gap-2">
                    <GithubIcon className="h-4 w-4" />
                    GitHub Repository
                  </p>
                  <p className="text-sm text-info/80 mt-1">
                    All source code, model training scripts, and documentation.
                  </p>
                </div>
                <a
                  href="https://github.com/Dhruv-Adhiya/DiagnoVision"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-info !text-white font-medium text-sm hover:bg-info/90 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <GithubIcon className="h-4 w-4" />
                  View on GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </RevealSection>
      </section>

      {/* ─── Dataset ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Dataset
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <Card variant="default" className="overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <CardContent className="py-5">
              <p className="text-secondary leading-relaxed">
                The model was trained on the <strong>{DATASET_INFO.name}</strong> dataset
                from {DATASET_INFO.source}, containing {DATASET_INFO.totalImages.toLocaleString()} images
                of {DATASET_INFO.imageType.toLowerCase()}.
              </p>
              <a
                href={DATASET_INFO.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary font-medium mt-3 hover:underline"
              >
                View Dataset on Kaggle
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        </RevealSection>
      </section>

      {/* ─── Research Context ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Research Context
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <Card variant="default" className="overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <CardContent className="py-5">
              <p className="text-secondary leading-relaxed">
                DiagnoVision explores the intersection of deep learning and medical imaging.
                The project demonstrates how convolutional neural networks — specifically transfer
                learning with EfficientNet-B0 — can be applied to chest X-ray classification for
                pneumonia detection, combined with explainability techniques (Grad-CAM) to make
                AI predictions interpretable.
              </p>
              <p className="text-secondary leading-relaxed mt-3">
                This is an academic project that serves as a practical demonstration of
                machine learning concepts including transfer learning, data augmentation,
                model evaluation, and explainable AI in a medical imaging context.
              </p>
            </CardContent>
          </Card>
        </RevealSection>
      </section>

      {/* ─── Disclaimer ─── */}
      <section className="mb-16">
        <RevealSection>
          <MedicalDisclaimer variant="full" />
        </RevealSection>
      </section>
    </Container>
  );
}
