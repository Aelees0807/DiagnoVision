import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/utils/formatting';

const heights = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

const colors = {
  normal: {
    track: 'bg-success-light/40',
    fill: 'from-success/70 to-success',
    glow: 'confidence-glow-success',
  },
  pneumonia: {
    track: 'bg-pneumonia-light/40',
    fill: 'from-pneumonia/70 to-pneumonia',
    glow: 'confidence-glow-pneumonia',
  },
};

/**
 * Visual horizontal bar representing model confidence.
 * Enhanced with gradient fill, shimmer overlay, and variant-colored glow.
 * @see docs/frontend/components.md — ConfidenceBar
 */
export default function ConfidenceBar({
  value,
  variant = 'normal',
  showLabel = true,
  size = 'md',
  className,
}) {
  /* animate the bar from 0 → value on mount */
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    /* small delay so the transition is visible */
    const raf = requestAnimationFrame(() => {
      setDisplayValue(Math.min(100, Math.max(0, value)));
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const { track, fill, glow } = colors[variant] || colors.normal;

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-secondary">Confidence</span>
          <span
            className={cn(
              'text-sm font-bold font-mono tabular-nums',
              variant === 'pneumonia' ? 'text-pneumonia' : 'text-success'
            )}
          >
            {formatPercent(value)}
          </span>
        </div>
      )}

      <div
        className={cn(
          'w-full rounded-full overflow-hidden transition-shadow duration-700',
          track,
          heights[size],
          displayValue > 0 && glow
        )}
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence: ${formatPercent(value)}`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden',
            'bg-gradient-to-r',
            fill
          )}
          style={{ width: `${displayValue}%` }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 progress-shimmer" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
