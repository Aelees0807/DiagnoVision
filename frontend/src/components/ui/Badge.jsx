import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-semibold rounded-full border transition-colors',
  {
    variants: {
      variant: {
        normal: 'bg-success-bg text-success border-success-light',
        pneumonia: 'bg-pneumonia-bg text-pneumonia border-pneumonia-light',
        success: 'bg-success-bg text-success border-success-light',
        warning: 'bg-warning-bg text-warning border-warning-light',
        error: 'bg-error-bg text-error border-error-light',
        info: 'bg-info-bg text-info border-info-light',
        default: 'bg-surface-hover text-secondary border-border',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

/**
 * Status badge for classification labels and indicators.
 * @see docs/frontend/components.md — Badge
 */
export function Badge({ className, variant, size, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {children}
    </span>
  );
}
