import { cn } from '@/lib/utils';
import { useScrollReveal, useCountUp } from '@/hooks/useScrollReveal';

/**
 * MetricCard with animated counter that triggers on scroll into view.
 * Includes subtle gradient hover, glow, and depth effects.
 * @see docs/frontend/components.md — MetricCard
 */
export default function MetricCard({ label, value, description, icon, className }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3 });

  // Extract numeric portion for animation
  const numericMatch = value?.match(/([\d.]+)/);
  const numericValue = numericMatch ? parseFloat(numericMatch[1]) : null;
  const suffix = numericMatch ? value.replace(numericMatch[1], '') : value;
  const decimals = numericMatch && numericMatch[1].includes('.') ? numericMatch[1].split('.')[1].length : 0;

  const countedValue = useCountUp(numericValue ?? 0, isVisible, { duration: 2200, decimals });

  return (
    <div
      ref={ref}
      className={cn(
        'group relative bg-white/80 backdrop-blur-sm border border-border rounded-xl p-5 text-center',
        'shadow-sm hover:shadow-xl transition-all duration-500',
        'card-float overflow-hidden',
        className
      )}
    >
      {/* Animated gradient overlay */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(135deg, rgba(30,107,138,0.04) 0%, rgba(43,108,176,0.04) 100%)',
        }}
      />

      {/* Glow accent on bottom edge */}
      <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative">
        {icon && (
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary-light to-info-light text-primary mb-3 transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
        )}
        <p
          className={cn(
            'text-2xl md:text-3xl font-bold text-foreground font-mono tracking-tight transition-all duration-300',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
        >
          {numericValue !== null ? `${countedValue}${suffix}` : value}
        </p>
        <p className="text-sm font-medium text-secondary mt-1">{label}</p>
        {description && (
          <p className="text-xs text-muted mt-2 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
}
