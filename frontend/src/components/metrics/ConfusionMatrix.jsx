import { cn } from '@/lib/utils';
import { useScrollReveal, useCountUp } from '@/hooks/useScrollReveal';

/**
 * Animated cell for the confusion matrix.
 */
function MatrixCell({ value, total, label, correct, delay = 0 }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3 });
  const pct = ((value / total) * 100);
  const countedVal = useCountUp(value, isVisible, { duration: 1800, decimals: 0 });

  return (
    <div
      ref={ref}
      className={cn(
        'relative rounded-xl p-5 text-center transition-all duration-500 overflow-hidden',
        'hover:scale-[1.04] cursor-default group',
        correct
          ? 'bg-gradient-to-br from-success-bg to-success-light/50 border border-success-light'
          : 'bg-gradient-to-br from-error-bg to-error-light/50 border border-error-light'
      )}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.85)',
        transitionDelay: `${delay}ms`,
      }}
      title={label}
      role="cell"
    >
      {/* Depth glow */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          correct ? 'shadow-[inset_0_0_30px_rgba(39,103,73,0.1)]' : 'shadow-[inset_0_0_30px_rgba(155,44,44,0.1)]'
        )}
      />
      <p
        className={cn(
          'text-3xl font-bold font-mono relative',
          correct ? 'text-success' : 'text-error'
        )}
      >
        {Math.round(parseFloat(countedVal))}
      </p>
      <p className={cn('text-xs mt-1.5 font-medium relative', correct ? 'text-success/70' : 'text-error/70')}>
        {pct.toFixed(1)}%
      </p>
      <p className={cn('text-[10px] mt-1 opacity-0 group-hover:opacity-70 transition-opacity relative', correct ? 'text-success' : 'text-error')}>
        {label}
      </p>
    </div>
  );
}

/**
 * Visual 2×2 confusion matrix with animated cells, color-coding, and axis labels.
 * @see docs/frontend/components.md — ConfusionMatrix
 */
export default function ConfusionMatrix({
  tn = 175,
  fp = 59,
  fn = 9,
  tp = 381,
  classNames = ['NORMAL', 'PNEUMONIA'],
}) {
  const total = tn + fp + fn + tp;

  return (
    <div className="w-full max-w-lg mx-auto" role="table" aria-label="Confusion matrix">
      {/* Title label */}
      <div className="text-center mb-4">
        <p className="text-xs font-semibold text-secondary uppercase tracking-widest">
          Predicted Label
        </p>
      </div>

      <div className="flex">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center mr-3">
          <p
            className="text-xs font-semibold text-secondary uppercase tracking-widest"
            style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
          >
            Actual Label
          </p>
        </div>

        <div className="flex-1">
          {/* Column headers (Predicted) */}
          <div className="flex mb-2" role="row">
            <div className="w-24 shrink-0" />
            <div className="flex-1 grid grid-cols-2 gap-3 text-center">
              <p className="text-xs font-semibold text-success uppercase tracking-wide" role="columnheader">
                {classNames[0]}
              </p>
              <p className="text-xs font-semibold text-pneumonia uppercase tracking-wide" role="columnheader">
                {classNames[1]}
              </p>
            </div>
          </div>

          {/* Row 1: Actual NORMAL */}
          <div className="flex mb-3" role="row">
            <div className="w-24 shrink-0 flex items-center" role="rowheader">
              <p className="text-xs font-semibold text-success">
                Actual<br />{classNames[0]}
              </p>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <MatrixCell value={tn} total={total} label="True Negative" correct={true} delay={0} />
              <MatrixCell value={fp} total={total} label="False Positive" correct={false} delay={100} />
            </div>
          </div>

          {/* Row 2: Actual PNEUMONIA */}
          <div className="flex" role="row">
            <div className="w-24 shrink-0 flex items-center" role="rowheader">
              <p className="text-xs font-semibold text-pneumonia">
                Actual<br />{classNames[1]}
              </p>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <MatrixCell value={fn} total={total} label="False Negative" correct={false} delay={200} />
              <MatrixCell value={tp} total={total} label="True Positive" correct={true} delay={300} />
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-5 text-xs text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gradient-to-br from-success-bg to-success-light border border-success-light" />
          Correct Prediction
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gradient-to-br from-error-bg to-error-light border border-error-light" />
          Incorrect Prediction
        </span>
      </div>
    </div>
  );
}
