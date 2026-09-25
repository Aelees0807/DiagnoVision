import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Card container with variants and optional hover float effect.
 * @see docs/frontend/components.md — Card
 */
const Card = forwardRef(({ className, variant = 'default', hover = false, children, ...props }, ref) => {
  const variants = {
    default: 'bg-white border-border shadow-md',
    glass: 'glass card-depth',
    success: 'bg-success-bg border-success-light',
    warning: 'bg-warning-bg border-warning-light',
    pneumonia: 'bg-pneumonia-bg border-pneumonia-light',
    info: 'bg-info-bg border-info-light',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border transition-all duration-300',
        variants[variant],
        hover && 'card-float',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

const CardHeader = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
));

const CardTitle = forwardRef(({ className, as: Tag = 'h3', ...props }, ref) => (
  <Tag ref={ref} className={cn('text-xl font-semibold leading-tight text-foreground', className)} {...props} />
));

const CardDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-secondary', className)} {...props} />
));

const CardContent = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));

const CardFooter = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
));

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardTitle.displayName = 'CardTitle';
CardDescription.displayName = 'CardDescription';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
