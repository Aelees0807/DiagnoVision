import { cn } from '@/lib/utils';
import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * Wrapper that animates children into view on scroll.
 * Supports multiple animation directions.
 * @param {{ direction?: 'up'|'down'|'left'|'right'|'scale', delay?: number, className?: string, children: React.ReactNode }} props
 */
export default function RevealSection({ direction = 'up', delay = 0, className, children, ...props }) {
  const { ref, isVisible } = useScrollReveal();

  const transforms = {
    up: 'translate3d(0, 32px, 0)',
    down: 'translate3d(0, -32px, 0)',
    left: 'translate3d(32px, 0, 0)',
    right: 'translate3d(-32px, 0, 0)',
    scale: 'scale(0.92)',
  };

  return (
    <div
      ref={ref}
      className={cn('transition-all duration-700 ease-out', className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate3d(0,0,0) scale(1)' : transforms[direction],
        transitionDelay: `${delay}ms`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
