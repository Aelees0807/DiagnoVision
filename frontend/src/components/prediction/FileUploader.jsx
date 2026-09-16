import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileImage, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateFile } from '@/utils/fileValidation';
import { formatFileSize } from '@/utils/formatting';
import { UPLOAD_CONSTRAINTS } from '@/constants';

/**
 * Drag-and-drop + browse file upload zone for X-ray images.
 * @see docs/frontend/components.md — FileUploader
 */
export default function FileUploader({
  onFileSelect,
  onFileRemove,
  selectedFile,
  error,
  disabled = false,
  acceptedFormats = UPLOAD_CONSTRAINTS.acceptedFormats,
  maxSizeMB = UPLOAD_CONSTRAINTS.maxSizeMB,
}) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /* ── helpers ── */
  const handleFile = useCallback(
    (file) => {
      if (disabled) return;
      const { valid, error: validationError } = validateFile(file);
      if (valid) {
        onFileSelect(file);
      } else {
        /* surface validation error through parent */
        onFileSelect(null, validationError);
      }
    },
    [disabled, onFileSelect]
  );

  /* ── drop handlers ── */
  const onDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 1) {
        onFileSelect(null, 'Please upload one image at a time.');
        return;
      }
      if (files.length === 1) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile, onFileSelect]
  );

  /* ── click / input change ── */
  const openPicker = useCallback(() => {
    if (!disabled && inputRef.current) inputRef.current.click();
  }, [disabled]);

  const onInputChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      /* reset input so re-selecting the same file triggers onChange */
      e.target.value = '';
    },
    [handleFile]
  );

  /* ── accept string for <input> ── */
  const acceptStr = acceptedFormats.join(',');

  /* ── state-derived classes ── */
  const hasFile = !!selectedFile;
  const hasError = !!error;

  const zoneClasses = cn(
    'relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
    disabled && 'opacity-50 cursor-not-allowed',
    hasError && 'border-error bg-error-bg/40',
    hasFile && !hasError && 'border-success bg-success-bg/30',
    isDragOver && !hasFile && !hasError && 'border-primary bg-primary-light/50 scale-[1.01]',
    !hasFile && !hasError && !isDragOver && 'border-border bg-white/50 hover:border-primary/40 hover:bg-primary-light/20',
  );

  return (
    <div className="upload-zone-wrapper">
      <div
        className={zoneClasses}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={!hasFile ? openPicker : undefined}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !hasFile) {
            e.preventDefault();
            openPicker();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload chest X-ray image"
        aria-disabled={disabled}
      >
        {/* hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={acceptStr}
          onChange={onInputChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          disabled={disabled}
        />

        {hasFile ? (
          /* ── File Selected State ── */
          <div className="p-6 flex flex-col items-center gap-3 animate-fade-in-up">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-success-bg flex items-center justify-center">
                <FileImage className="h-7 w-7 text-success" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground truncate max-w-[260px]">
                {selectedFile.name}
              </p>
              <p className="text-xs text-secondary mt-0.5">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFileRemove();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-error hover:text-error/80 transition-colors mt-1 px-3 py-1.5 rounded-lg hover:bg-error-bg/60"
              aria-label="Remove selected file"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        ) : (
          /* ── Empty / Drag-Over State ── */
          <div className="p-10 md:p-12 flex flex-col items-center gap-4">
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300',
                isDragOver
                  ? 'bg-primary/10 scale-110'
                  : 'bg-primary-light group-hover:bg-primary/10'
              )}
            >
              <Upload
                className={cn(
                  'h-8 w-8 transition-all duration-300',
                  isDragOver
                    ? 'text-primary scale-110'
                    : 'text-primary/60 group-hover:text-primary'
                )}
              />
            </div>

            <div className="text-center">
              <p className="text-base font-semibold text-foreground">
                {isDragOver ? 'Drop your image here' : 'Drag & drop your chest X-ray here'}
              </p>
              <p className="text-sm text-secondary mt-1">or click to browse</p>
            </div>

            <p className="text-xs text-muted text-center">
              Accepted formats: {acceptedFormats.join(', ')} · Max size: {maxSizeMB} MB
            </p>
          </div>
        )}
      </div>

      {/* ── Error Message ── */}
      {hasError && (
        <div
          className="mt-3 flex items-center gap-2 text-sm text-error animate-fade-in-up"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

