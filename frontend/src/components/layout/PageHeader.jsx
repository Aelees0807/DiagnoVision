import { cn } from '@/lib/utils';

/**
 * Consistent page title and description section.
 * Renders as semantic <header> with <h1>.
 * @param {{ title: string, description?: string, className?: string }} props
 */
export default function PageHeader({ title, description, className }) {
  return (
    <header className={cn('py-8 md:py-12', className)}>
      <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight animate-fade-in-up">
        {title}
      </h1>
      {description && (
        <p className="mt-3 text-lg text-secondary max-w-2xl animate-fade-in-up stagger-1" style={{ opacity: 0 }}>
          {description}
        </p>
      )}
    </header>
  );
}
