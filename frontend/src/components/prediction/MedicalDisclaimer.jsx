import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mandatory AI disclaimer — never dismissible.
 * Enhanced with glass-panel treatment and warm-tinted backdrop.
 * @see docs/frontend/components.md — MedicalDisclaimer
 */
export default function MedicalDisclaimer({ variant = 'full', className }) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'rounded-xl border border-warning-light/60',
        'glass-panel',
        isCompact ? 'p-3' : 'p-5',
        className
      )}
      role="alert"
      aria-label="Medical disclaimer"
    >
      <div className={cn('flex gap-3', isCompact ? 'items-center' : 'items-start')}>
        <AlertTriangle
          className={cn(
            'shrink-0 text-warning',
            isCompact ? 'h-4 w-4' : 'h-5 w-5 mt-0.5'
          )}
        />
        <div>
          {!isCompact && (
            <p className="font-semibold text-warning mb-1">Important Notice</p>
          )}
          <p className={cn('text-warning/90', isCompact ? 'text-xs' : 'text-sm leading-relaxed')}>
            This is an AI-assisted screening result, not a medical diagnosis.
            The confidence score reflects model output and should not be interpreted
            as medical certainty. Always consult a qualified healthcare professional
            for clinical decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
