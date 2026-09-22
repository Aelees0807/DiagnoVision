import { useState, useCallback, useRef, useEffect } from 'react';
import { Eye, Layers, SlidersHorizontal, Maximize2, Info, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Grad-CAM heatmap viewer with animated reveal, layered visualization,
 * opacity slider, full-screen modal, and keyboard accessibility.
 *
 * Decorative effects (glow, glass) are applied to CONTAINERS only —
 * never over the medical imagery itself.
 *
 * @see docs/frontend/components.md — GradCAMViewer
 * @see docs/frontend/design.md §10 — Prediction Result Design
 */

/** View modes for the toggle control */
const VIEW_MODES = [
  { id: 'original', label: 'Original', icon: Eye, shortLabel: 'Original' },
  { id: 'overlay', label: 'Grad-CAM', icon: Layers, shortLabel: 'Overlay' },
  { id: 'blend', label: 'Blend', icon: SlidersHorizontal, shortLabel: 'Blend' },
];

export default function GradCAMViewer({
  originalImage,
  gradcamImage,
  isLoading = false,
  error = null,
  className,
}) {
  const [viewMode, setViewMode] = useState('original');
  const [overlayOpacity, setOverlayOpacity] = useState(0.55);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const sliderRef = useRef(null);
  const containerRef = useRef(null);
  const fullScreenRef = useRef(null);

  /* Determine capabilities */
  const hasGradcam = !!gradcamImage;
  const canToggle = hasGradcam && !isLoading && !error;

  /* Trigger the clip-path reveal animation after mount */
  useEffect(() => {
    const timer = setTimeout(() => setIsRevealed(true), 100);
    return () => clearTimeout(timer);
  }, []);

  /* Full-screen keyboard handling */
  useEffect(() => {
    if (!isFullScreen) return;

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFullScreen(false);
      }
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    /* Focus the close button when modal opens */
    if (fullScreenRef.current) {
      fullScreenRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  /* Handle toggle keyboard interaction */
  const handleToggleKeyDown = useCallback(
    (e) => {
      if (!canToggle) return;
      const currentIndex = VIEW_MODES.findIndex((m) => m.id === viewMode);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = (currentIndex + 1) % VIEW_MODES.length;
        setViewMode(VIEW_MODES[next].id);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = (currentIndex - 1 + VIEW_MODES.length) % VIEW_MODES.length;
        setViewMode(VIEW_MODES[prev].id);
      }
    },
    [canToggle, viewMode]
  );

  /* Compute overlay opacity based on mode */
  const computedOverlayOpacity = viewMode === 'overlay' ? 1 : viewMode === 'blend' ? overlayOpacity : 0;
  const showOriginal = viewMode === 'original' || viewMode === 'blend';

  /* Build the image display (reused in inline + fullscreen) */
  const renderImageViewer = (isModal = false) => {
    const maxH = isModal ? 'max-h-[80vh]' : 'max-h-[400px]';

    return (
      <div className="relative w-full overflow-hidden bg-gray-900 rounded-xl">
        {/* Original X-ray — always the base layer */}
        <img
          src={originalImage}
          alt="Uploaded chest X-ray image"
          className={cn(
            'block w-full h-auto object-contain',
            maxH,
            isRevealed && !isModal && 'animate-image-reveal',
            /* Keep original visible unless fully overlaid */
            showOriginal ? 'opacity-100' : 'opacity-0',
            'transition-opacity duration-500'
          )}
          draggable={false}
        />

        {/* Grad-CAM overlay — sits on top with computed opacity */}
        {canToggle && (
          <img
            src={`data:image/png;base64,${gradcamImage}`}
            alt="Grad-CAM heatmap overlay showing model attention areas"
            className={cn(
              'absolute inset-0 w-full h-full object-contain',
              'transition-opacity duration-500 ease-out',
              maxH
            )}
            style={{ opacity: computedOverlayOpacity }}
            draggable={false}
          />
        )}

        {/* Loading skeleton overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-3 border-primary-light" />
              <div
                className="absolute inset-0 w-12 h-12 rounded-full border-3 border-primary border-t-transparent animate-spin"
                style={{ animationDuration: '0.8s' }}
              />
            </div>
            <p className="text-sm text-secondary font-medium">Generating heatmap…</p>
          </div>
        )}

        {/* Error overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-sm p-6">
            <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-muted" />
            </div>
            <p className="text-sm text-secondary text-center font-medium">
              Visual explanation is temporarily unavailable.
            </p>
            <p className="text-xs text-muted text-center">
              The prediction result is still valid.
            </p>
          </div>
        )}

        {/* Expand button — only on inline viewer */}
        {!isModal && !isLoading && !error && (
          <button
            type="button"
            onClick={() => setIsFullScreen(true)}
            className={cn(
              'absolute top-3 right-3 p-2 rounded-lg',
              'bg-foreground/50 text-white backdrop-blur-sm',
              'opacity-0 group-hover:opacity-100 transition-all duration-200',
              'hover:bg-foreground/70 focus-visible:opacity-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
            )}
            aria-label="View full size"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* ── Main Image Container ── */}
      <div
        ref={containerRef}
        className="group relative rounded-2xl overflow-hidden gradcam-glow"
      >
        {renderImageViewer(false)}
      </div>

      {/* ── Glass Control Bar ── */}
      <div className="glass-panel rounded-xl p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Toggle buttons */}
          <div
            className="inline-flex rounded-lg border border-border overflow-hidden"
            role="radiogroup"
            aria-label="Image view mode"
            onKeyDown={handleToggleKeyDown}
          >
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = viewMode === mode.id;
              const isDisabled = mode.id !== 'original' && !canToggle;

              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`View ${mode.label}`}
                  onClick={() => !isDisabled && setViewMode(mode.id)}
                  disabled={isDisabled}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-secondary hover:bg-surface-hover',
                    isDisabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{mode.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Opacity slider — only visible in blend mode */}
          <div
            className={cn(
              'flex items-center gap-2 transition-all duration-300 overflow-hidden',
              viewMode === 'blend' && canToggle
                ? 'max-w-[200px] opacity-100'
                : 'max-w-0 opacity-0 pointer-events-none'
            )}
          >
            <label
              htmlFor="gradcam-opacity"
              className="text-xs text-secondary font-medium whitespace-nowrap"
            >
              Opacity
            </label>
            <input
              ref={sliderRef}
              id="gradcam-opacity"
              type="range"
              min="0"
              max="100"
              value={Math.round(overlayOpacity * 100)}
              onChange={(e) => setOverlayOpacity(parseInt(e.target.value, 10) / 100)}
              className="gradcam-slider w-24"
              aria-label={`Grad-CAM overlay opacity: ${Math.round(overlayOpacity * 100)}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(overlayOpacity * 100)}
            />
            <span className="text-xs font-mono text-muted tabular-nums w-8 text-right">
              {Math.round(overlayOpacity * 100)}%
            </span>
          </div>

          {/* Info tooltip */}
          <div className="relative ml-auto">
            <button
              type="button"
              className={cn(
                'p-2 rounded-lg text-muted transition-colors',
                'hover:text-secondary hover:bg-surface-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
              )}
              aria-label="What is Grad-CAM?"
              aria-expanded={showTooltip}
              onClick={() => setShowTooltip(!showTooltip)}
              onBlur={() => setTimeout(() => setShowTooltip(false), 150)}
            >
              <Info className="h-4 w-4" />
            </button>

            {/* Tooltip content */}
            <div
              className={cn(
                'absolute bottom-full right-0 mb-2 w-72 p-4 rounded-xl',
                'glass-panel-elevated text-foreground shadow-lg z-20',
                'transition-all duration-200',
                showTooltip
                  ? 'opacity-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 translate-y-1 pointer-events-none'
              )}
              role="tooltip"
            >
              <p className="font-semibold text-sm mb-1.5">What is Grad-CAM?</p>
              <p className="text-xs text-secondary leading-relaxed">
                Gradient-weighted Class Activation Mapping highlights the image regions
                the AI model focused on when making its prediction. Warmer colors
                (red/yellow) indicate areas of higher importance to the model's decision.
              </p>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                This visualization is generated from the final convolutional layer
                of the EfficientNet-B0 model using the target class gradients.
              </p>
              <div className="absolute bottom-0 right-5 translate-y-1/2 rotate-45 w-2.5 h-2.5 glass-panel-elevated border-t-0 border-l-0" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Full-Screen Modal ── */}
      {isFullScreen && (
        <div
          className="fixed inset-0 h-[100dvh] z-50 flex items-center justify-center p-4 md:p-8 image-modal-bg animate-fade-in-up"
          style={{ animationDuration: '0.2s' }}
          role="dialog"
          aria-modal="true"
          aria-label="Full-size X-ray viewer"
        >
          {/* Close button */}
          <button
            ref={fullScreenRef}
            type="button"
            onClick={() => setIsFullScreen(false)}
            className={cn(
              'absolute top-4 right-4 z-10 p-2.5 rounded-xl',
              'bg-white/10 text-white backdrop-blur-sm',
              'hover:bg-white/20 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
            )}
            aria-label="Close full-size viewer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Full-size image */}
          <div className="w-full max-w-3xl animate-scale-in">
            {renderImageViewer(true)}

            {/* Modal controls */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <div
                className="inline-flex rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm"
                role="radiogroup"
                aria-label="Image view mode"
                onKeyDown={handleToggleKeyDown}
              >
                {VIEW_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = viewMode === mode.id;
                  const isDisabled = mode.id !== 'original' && !canToggle;

                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => !isDisabled && setViewMode(mode.id)}
                      disabled={isDisabled}
                      tabIndex={isActive ? 0 : -1}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-white text-foreground'
                          : 'text-white/70 hover:text-white hover:bg-white/10',
                        isDisabled && 'opacity-30 cursor-not-allowed'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {/* Blend slider in modal */}
              {viewMode === 'blend' && canToggle && (
                <div className="flex items-center gap-2 ml-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(overlayOpacity * 100)}
                    onChange={(e) => setOverlayOpacity(parseInt(e.target.value, 10) / 100)}
                    className="gradcam-slider w-28"
                    aria-label={`Overlay opacity: ${Math.round(overlayOpacity * 100)}%`}
                  />
                  <span className="text-xs font-mono text-white/60 tabular-nums">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
