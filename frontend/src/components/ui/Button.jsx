import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-primary to-primary-hover text-white rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
        secondary:
          'border-2 border-primary text-primary bg-transparent rounded-lg hover:bg-primary-light active:bg-primary-light/70',
        outline:
          'border border-border text-secondary bg-transparent rounded-lg hover:bg-surface-hover hover:text-foreground',
        danger:
          'bg-error text-white rounded-lg hover:bg-error/90 shadow-md',
        ghost:
          'text-secondary rounded-lg hover:bg-surface-hover hover:text-foreground',
      },
      size: {
        sm: 'h-9 px-4 text-sm rounded-md',
        md: 'h-11 px-6 text-base',
        lg: 'h-13 px-8 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

/**
 * Button component with variants, loading state, and micro-interactions.
 * @see docs/frontend/components.md — Button
 */
const Button = forwardRef(
  ({ className, variant, size, isLoading, icon, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing…</span>
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
