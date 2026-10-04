import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Full-screen splash / intro video overlay.
 * Plays `public/intro.mp4` once, then fades out and unmounts itself
 * so the main application is revealed underneath.
 *
 * – Skippable via click / tap / keyboard
 * – Respects prefers-reduced-motion (skips automatically)
 * – Uses sessionStorage so it only shows once per browser session
 */
const STORAGE_KEY = 'diagnovision_splash_seen';

export default function SplashScreen({ onComplete }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState('playing'); // playing → fading → done

  /* Skip if already seen this session or user prefers reduced motion */
  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(STORAGE_KEY);
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (alreadySeen || prefersReduced) {
      finish();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Mark as seen and begin fade-out */
  const finish = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setPhase('fading');
  }, []);

  /* After fade-out animation completes, tell parent we're done */
  useEffect(() => {
    if (phase === 'fading') {
      const timer = setTimeout(() => {
        setPhase('done');
        onComplete();
      }, 800); // matches CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  /* When video naturally ends */
  const handleEnded = useCallback(() => {
    finish();
  }, [finish]);

  /* Skip on click / tap */
  const handleSkip = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
    finish();
  }, [finish]);

  /* Skip on Escape / Enter / Space */
  useEffect(() => {
    const handler = (e) => {
      if (['Escape', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSkip]);

  if (phase === 'done') return null;

  return (
    <div
      className="splash-overlay"
      style={{
        opacity: phase === 'fading' ? 0 : 1,
      }}
      onClick={handleSkip}
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleEnded}
        className="splash-video"
      />

      {/* Skip hint */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        className="splash-skip"
      >
        Skip Intro ›
      </button>
    </div>
  );
}
