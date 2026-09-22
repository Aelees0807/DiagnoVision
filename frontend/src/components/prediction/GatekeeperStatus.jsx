import { ShieldCheck, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/utils/formatting';

/**
 * Gatekeeper model status bar — passed or rejected.
 * Enhanced with glass-panel backdrop and icon pulse animation on passed.
 * @see docs/frontend/components.md — GatekeeperStatus
 */
export default function GatekeeperStatus({ status, confidence, className }) {
  const isPassed = status === 'passed';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-xl transition-all duration-500',
        'glass-panel',
        isPassed
          ? 'border-success-light/60 text-success'
          : 'border-pneumonia-light/60 text-pneumonia',
        className
      )}
      role="status"
      aria-label={`Gatekeeper: ${isPassed ? 'Passed' : 'Rejected'}`}
    >
      {/* Icon */}
      <div
        className={cn(
          'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
          isPassed ? 'bg-success/10' : 'bg-pneumonia/10',
          isPassed && 'animate-icon-pulse-success'
        )}
      >
        {isPassed ? (
          <ShieldCheck className="h-5 w-5" />
        ) : (
          <ShieldX className="h-5 w-5" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          Gatekeeper:{' '}
          <span className="uppercase">{isPassed ? 'Passed' : 'Rejected'}</span>
        </p>
        <p className="text-xs opacity-80 mt-0.5">
          {isPassed
            ? 'Chest X-ray confirmed'
            : 'Not a chest X-ray'}
        </p>
      </div>

      {/* Confidence */}
      <span className="text-sm font-bold font-mono tabular-nums shrink-0">
        {formatPercent(confidence)}
      </span>
    </div>
  );
}
