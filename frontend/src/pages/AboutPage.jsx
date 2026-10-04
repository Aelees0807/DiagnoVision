import { useEffect, useLayoutEffect } from 'react';
import {
  ExternalLink, Brain,
  BookOpen, HeartPulse, Sparkles, Shield, Eye,
  Stethoscope, GraduationCap, Users, Mail, User,
} from 'lucide-react';
import GithubIcon from '@/components/ui/GithubIcon';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import RevealSection from '@/components/ui/RevealSection';
import MedicalDisclaimer from '@/components/prediction/MedicalDisclaimer';
import { PNEUMONIA_MODEL } from '@/constants';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function AboutPage() {
  useDocumentTitle('About');
  
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

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

      {/* ─── Developers ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Developers
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'Dhruv Adhiya', image: '/Photos/DhruvAdhiya.png' },
              { name: 'Aelees Bhuva', image: '/Photos/AeleesBhuva.png' },
              { name: 'Yash Boghara', image: '/Photos/YashBoghara.jpeg' },
              { name: 'Preet Dhoriyani', image: '/Photos/PreetDhoriyani.jpeg' },
            ].map((dev) => (
              <Card key={dev.name} variant="default" hover className="overflow-hidden group">
                <div className="aspect-square bg-muted/20 flex items-center justify-center relative overflow-hidden">
                  <img 
                    src={dev.image} 
                    alt={dev.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                </div>
                <CardContent className="py-5 text-center">
                  <h3 className="text-lg font-semibold text-foreground">{dev.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </RevealSection>
      </section>

      {/* ─── Contact ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Contact Us
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <Card variant="default" className="overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <CardContent className="py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground">Get in Touch</h3>
                <p className="text-sm text-secondary mt-1">
                  Have questions, feedback, or inquiries? Feel free to reach out to us via email.
                </p>
              </div>
              <a
                href="mailto:diagnovision@gmail.com"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors shrink-0"
              >
                <Mail className="h-4 w-4" />
                diagnovision@gmail.com
              </a>
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
