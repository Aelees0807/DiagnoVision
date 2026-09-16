import { cn } from '@/lib/utils';

const sizes = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
};

/**
 * Max-width content wrapper for page centering.
 * @param {{ size?: 'sm'|'md'|'lg'|'xl', className?: string, children: React.ReactNode }} props
 */
export default function Container({ size = 'lg', className, children }) {
  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', sizes[size], className)}>
      {children}
    </div>
  );
}
