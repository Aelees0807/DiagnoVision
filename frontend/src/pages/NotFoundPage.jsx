import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Activity } from 'lucide-react';
import Container from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import ParticleField from '@/components/ui/ParticleField';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page Not Found');
  return (
    <Container size="sm">
      <div className="relative flex flex-col items-center justify-center py-24 md:py-32 text-center overflow-hidden">
        {/* Particle background */}
        <ParticleField count={20} />

        {/* Animated 404 */}
        <div className="relative mb-8">
          <span
            className="text-[8rem] md:text-[10rem] font-bold gradient-text leading-none select-none"
            aria-hidden="true"
          >
            404
          </span>
          {/* Glow effect behind text */}
          <div
            className="absolute inset-0 blur-3xl rounded-full opacity-30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(30,107,138,0.15), transparent 70%)',
            }}
            aria-hidden="true"
          />
          {/* Floating icon accent */}
          <div className="absolute -top-2 -right-4 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg shadow-primary/20 animate-float">
            <Activity className="h-6 w-6 text-white" />
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Page Not Found
        </h1>
        <p className="text-secondary max-w-md mb-10">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link to="/">
            <Button icon={<Home className="h-4 w-4" />}>
              Back to Home
            </Button>
          </Link>
          <Button
            variant="outline"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    </Container>
  );
}
