import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/utils/formatting';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import ConfidenceBar from './ConfidenceBar';

/**
 * Prediction result card — classification, confidence, probability breakdown.
 * Enhanced with glass-panel-elevated, hover depth transitions, and shimmer effect.
 * @see docs/frontend/components.md — PredictionCard
 * @see docs/frontend/design.md §10 — Prediction Result Design
 */
export default function PredictionCard({
  prediction,
  confidence,
  normalProbability,
  pneumoniaProbability,
  modelName = 'EfficientNet-B0',
  animated = false,
  className,
}) {
  const isNormal = prediction === 'NORMAL';
  const variant = isNormal ? 'normal' : 'pneumonia';

  /* Animated counter values — count up from 0 to target */
  const animatedConfidence = useAnimatedCounter(confidence, 1400, 1, animated);
  const animatedNormal = useAnimatedCounter(normalProbability, 1200, 1, animated);
  const animatedPneumonia = useAnimatedCounter(pneumoniaProbability, 1200, 1, animated);

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden card-float',
        'glass-panel-elevated',
        isNormal ? 'border-l-4 border-l-success' : 'border-l-4 border-l-pneumonia',
        className
      )}
      role="alert"
      aria-label={`AI screening result: ${prediction}`}
    >
      {/* ── Header ── */}
      <div
        className={cn(
          'px-6 py-4 flex items-center gap-3',
          isNormal ? 'bg-success-bg/30' : 'bg-pneumonia-bg/30'
        )}
      >
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            isNormal ? 'bg-success/10' : 'bg-pneumonia/10'
          )}
        >
          {isNormal ? (
            <ShieldCheck className="h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-pneumonia" />
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-secondary uppercase tracking-wider">
            AI Screening Result
          </p>
          <p
            className={cn(
              'text-lg font-bold tracking-wide',
              isNormal ? 'text-success' : 'text-pneumonia',
              animated && 'animate-number-pop'
            )}
          >
            {prediction}
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5 space-y-5">
        {/* Confidence bar */}
        <div>
          <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">
            Model Confidence
          </p>
          <div className="flex items-end gap-3 mb-2">
            <span
              className={cn(
                'text-3xl font-bold font-mono tabular-nums leading-none',
                isNormal ? 'text-success' : 'text-pneumonia',
                animated && 'animate-number-pop stagger-2'
              )}
              style={animated ? { opacity: 0 } : undefined}
            >
              {formatPercent(animated ? animatedConfidence : confidence)}
            </span>
          </div>
          <ConfidenceBar value={confidence} variant={variant} showLabel={false} size="md" />
        </div>

        {/* Probability breakdown */}
        <div>
          <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-3">
            Probability Breakdown
          </p>
          <div className="space-y-2.5">
            {/* NORMAL */}
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'w-3 h-3 rounded-full shrink-0',
                  isNormal ? 'bg-success ring-2 ring-success/20' : 'bg-success/40'
                )}
              />
              <span className="text-sm font-medium text-foreground w-24">NORMAL</span>
              <div className="flex-1 h-2 bg-surface-hover/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-success/50 to-success/70 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${animated ? animatedNormal : normalProbability}%` }}
                />
              </div>
              <span className="text-sm font-mono tabular-nums text-secondary w-16 text-right">
                {formatPercent(animated ? animatedNormal : normalProbability)}
              </span>
              {isNormal && (
                <span className="text-success text-xs font-bold" aria-label="Predicted class">◀</span>
              )}
            </div>

            {/* PNEUMONIA */}
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'w-3 h-3 rounded-full shrink-0',
                  !isNormal ? 'bg-pneumonia ring-2 ring-pneumonia/20' : 'bg-pneumonia/40'
                )}
              />
              <span className="text-sm font-medium text-foreground w-24">PNEUMONIA</span>
              <div className="flex-1 h-2 bg-surface-hover/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pneumonia/50 to-pneumonia/70 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${animated ? animatedPneumonia : pneumoniaProbability}%` }}
                />
              </div>
              <span className="text-sm font-mono tabular-nums text-secondary w-16 text-right">
                {formatPercent(animated ? animatedPneumonia : pneumoniaProbability)}
              </span>
              {!isNormal && (
                <span className="text-pneumonia text-xs font-bold" aria-label="Predicted class">◀</span>
              )}
            </div>
          </div>
        </div>

        {/* Model info */}
        <div className="pt-3 border-t border-divider/50">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Model: <span className="font-medium text-secondary">{modelName}</span></span>
            <span>Input: <span className="font-medium text-secondary">224×224 RGB</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
