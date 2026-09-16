import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/utils/formatting';

/**
 * Display the uploaded X-ray image at an appropriate size.
 * @see docs/frontend/components.md — ImagePreview
 */
export default function ImagePreview({
  src,
  alt = 'Uploaded chest X-ray',
  maxSize = 300,
  onRemove,
  fileName,
  fileSize,
  className,
}) {
  if (!src) return null;

  return (
    <div className={cn('flex flex-col items-center gap-3 animate-scale-in', className)}>
      {/* Image container */}
      <div
        className="relative group rounded-xl overflow-hidden border border-border bg-white shadow-sm"
        style={{ maxWidth: maxSize, maxHeight: maxSize }}
      >
        <img
          src={src}
          alt={alt}
          className="block w-full h-full object-contain"
          style={{ maxWidth: maxSize, maxHeight: maxSize }}
        />

        {/* Remove overlay button */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              'absolute top-2 right-2 p-1.5 rounded-full',
              'bg-foreground/60 text-white backdrop-blur-sm',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
              'hover:bg-foreground/80 focus-visible:opacity-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
            )}
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* File info */}
      {(fileName || fileSize) && (
        <div className="text-center">
          {fileName && (
            <p className="text-sm font-medium text-foreground truncate max-w-[280px]">
              {fileName}
            </p>
          )}
          {fileSize && (
            <p className="text-xs text-secondary mt-0.5">
              {typeof fileSize === 'number' ? formatFileSize(fileSize) : fileSize}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
