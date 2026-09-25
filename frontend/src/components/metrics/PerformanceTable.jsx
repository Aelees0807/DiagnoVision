import { cn } from '@/lib/utils';
import { formatPercent } from '@/utils/formatting';
import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * Per-class metrics table with animated reveal and visual bar indicators.
 * @see docs/frontend/components.md — PerformanceTable
 */
export default function PerformanceTable({ metrics }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });

  if (!metrics) return null;

  const rows = Object.entries(metrics).map(([className, data]) => ({
    className,
    ...data,
  }));

  return (
    <div
      ref={ref}
      className={cn(
        'overflow-x-auto rounded-xl border border-border bg-white/80 backdrop-blur-sm shadow-sm',
        'transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      <table className="w-full text-sm" role="table" aria-label="Per-class performance metrics">
        <thead>
          <tr className="bg-gradient-to-r from-surface-hover to-surface-hover/60 border-b border-border">
            <th scope="col" className="text-left px-5 py-3.5 font-semibold text-secondary">Class</th>
            <th scope="col" className="text-right px-5 py-3.5 font-semibold text-secondary">Precision</th>
            <th scope="col" className="text-right px-5 py-3.5 font-semibold text-secondary">Recall</th>
            <th scope="col" className="text-right px-5 py-3.5 font-semibold text-secondary">F1 Score</th>
            <th scope="col" className="text-right px-5 py-3.5 font-semibold text-secondary">Support</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.className}
              className={cn(
                'border-b border-border/50 transition-all duration-300 hover:bg-primary-light/30',
                i % 2 === 0 ? 'bg-white' : 'bg-surface-hover/20'
              )}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateX(0)' : 'translateX(-12px)',
                transitionDelay: `${300 + i * 150}ms`,
              }}
            >
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      row.className === 'NORMAL' ? 'bg-success' : 'bg-pneumonia'
                    )}
                  />
                  <span className="font-semibold text-foreground">{row.className}</span>
                </div>
              </td>
              <td className="text-right px-5 py-4">
                <div className="inline-flex flex-col items-end gap-1">
                  <span className="font-mono font-semibold text-foreground">{formatPercent(row.precision)}</span>
                  <div className="w-16 h-1.5 bg-border/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-info transition-all duration-1000"
                      style={{
                        width: isVisible ? `${row.precision}%` : '0%',
                        transitionDelay: '500ms',
                      }}
                    />
                  </div>
                </div>
              </td>
              <td className="text-right px-5 py-4">
                <div className="inline-flex flex-col items-end gap-1">
                  <span className="font-mono font-semibold text-foreground">{formatPercent(row.recall)}</span>
                  <div className="w-16 h-1.5 bg-border/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-info transition-all duration-1000"
                      style={{
                        width: isVisible ? `${row.recall}%` : '0%',
                        transitionDelay: '600ms',
                      }}
                    />
                  </div>
                </div>
              </td>
              <td className="text-right px-5 py-4">
                <div className="inline-flex flex-col items-end gap-1">
                  <span className="font-mono font-semibold text-foreground">{formatPercent(row.f1)}</span>
                  <div className="w-16 h-1.5 bg-border/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-info transition-all duration-1000"
                      style={{
                        width: isVisible ? `${row.f1}%` : '0%',
                        transitionDelay: '700ms',
                      }}
                    />
                  </div>
                </div>
              </td>
              <td className="text-right px-5 py-4 font-mono text-muted">{row.support}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
