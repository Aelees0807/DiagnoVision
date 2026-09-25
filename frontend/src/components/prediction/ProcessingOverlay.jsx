import { useState, useEffect } from 'react';
import { Upload, Shield, Scan, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Processing steps for the prediction pipeline.
 * Displayed in the loading overlay to give users a detailed,
 * multi-step progress experience.
 */
const PROCESSING_STEPS = [
  {
    id: 'upload',
    label: 'Uploading Image',
    sublabel: 'Sending your image for analysis',
    icon: Upload,
    statusKey: 'uploading',
  },
  {
    id: 'gatekeeper',
    label: 'Gatekeeper Check',
    sublabel: 'Verifying chest X-ray validity',
    icon: Shield,
    statusKey: 'processing',
  },
  {
    id: 'predict',
    label: 'Running AI Analysis',
    sublabel: 'EfficientNet-B0 pneumonia screening',
    icon: Scan,
    statusKey: 'processing',
  },
  {
    id: 'gradcam',
    label: 'Generating Heatmap',
    sublabel: 'Creating Grad-CAM visualization',
    icon: Sparkles,
    statusKey: 'processing',
  },
];

/**
 * Multi-step processing overlay with advanced animations.
 * Shows the pipeline stages: Upload → Gatekeeper → Analysis → Grad-CAM.
 *
 * @param {{ status: string, uploadProgress: number }} props
 */
export default function ProcessingOverlay({ status, uploadProgress }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  /* Advance through processing steps on a timer to simulate pipeline stages */
  useEffect(() => {
    if (status === 'uploading') {
      setActiveStepIndex(0);
      return;
    }

    if (status === 'processing') {
      setActiveStepIndex(1);

      const timer1 = setTimeout(() => setActiveStepIndex(2), 900);
      const timer2 = setTimeout(() => setActiveStepIndex(3), 2000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [status]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in-up"
      style={{ animationDuration: '0.25s' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-md" />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-scale-in overflow-hidden">
        {/* Decorative background pulse rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="w-40 h-40 rounded-full bg-primary/5 animate-ping-slow" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="w-56 h-56 rounded-full bg-primary/3 animate-ping-slower" />
        </div>

        {/* Main spinner */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-[3px] border-primary-light" />
          {/* Spinning arc */}
          <div
            className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin"
            style={{ animationDuration: '1s' }}
          />
          {/* Secondary spinning arc (opposite direction) */}
          <div
            className="absolute inset-1 rounded-full border-2 border-info/30 border-b-transparent animate-spin"
            style={{ animationDuration: '1.6s', animationDirection: 'reverse' }}
          />
          {/* Center icon */}
          <div className="absolute inset-3 rounded-full bg-primary-light/40 flex items-center justify-center">
            {(() => {
              const StepIcon = PROCESSING_STEPS[activeStepIndex]?.icon || Scan;
              return (
                <StepIcon
                  key={activeStepIndex}
                  className="h-6 w-6 text-primary animate-fade-in-up"
                  style={{ animationDuration: '0.3s' }}
                />
              );
            })()}
          </div>
        </div>

        {/* Status heading — smooth transition */}
        <div className="text-center mb-6 min-h-[52px]">
          <p
            key={activeStepIndex}
            className="text-lg font-semibold text-foreground mb-1 animate-fade-in-up"
            style={{ animationDuration: '0.3s' }}
          >
            {PROCESSING_STEPS[activeStepIndex]?.label}
          </p>
          <p
            key={`sub-${activeStepIndex}`}
            className="text-sm text-secondary animate-fade-in-up"
            style={{ animationDuration: '0.3s', animationDelay: '0.05s', opacity: 0 }}
          >
            {PROCESSING_STEPS[activeStepIndex]?.sublabel}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {PROCESSING_STEPS.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            const isComplete = idx < activeStepIndex;
            const StepIcon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-500',
                  isComplete && 'bg-success-bg text-success',
                  isActive && 'bg-primary-light text-primary ring-1 ring-primary/20 scale-105',
                  !isComplete && !isActive && 'bg-surface-hover text-muted'
                )}
              >
                {isComplete ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <StepIcon className={cn('h-3 w-3', isActive && 'animate-pulse-soft')} />
                )}
                <span className="hidden sm:inline">{step.id === 'gatekeeper' ? 'Gate' : step.id === 'predict' ? 'AI' : step.id === 'gradcam' ? 'CAM' : 'Upload'}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-primary-light/50 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out progress-shimmer relative"
            style={{
              width:
                status === 'processing'
                  ? `${Math.min(30 + activeStepIndex * 25, 95)}%`
                  : `${uploadProgress}%`,
            }}
          />
        </div>

        <p className="text-xs text-muted text-center">
          {status === 'uploading'
            ? `${uploadProgress}% uploaded`
            : 'Processing — this may take a few seconds'}
        </p>

        {/* Bottom gradient accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 gradient-border-animated" />
      </div>
    </div>
  );
}
