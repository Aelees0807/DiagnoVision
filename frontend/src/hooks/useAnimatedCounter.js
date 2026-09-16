import { useState, useEffect, useRef } from 'react';

/**
 * Animate a numeric value from 0 to the target value over a given duration.
 * Uses requestAnimationFrame for smooth 60fps animation with an easeOutExpo curve.
 *
 * @param {number} target - Target value to animate to
 * @param {number} [duration=1200] - Animation duration in ms
 * @param {number} [decimals=1] - Decimal precision
 * @param {boolean} [enabled=true] - Whether animation should play
 * @returns {number} The current animated value
 */
export function useAnimatedCounter(target, duration = 1200, decimals = 1, enabled = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!enabled || target === 0) {
      setValue(target);
      return;
    }

    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const current = parseFloat((easedProgress * target).toFixed(decimals));
      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(parseFloat(target.toFixed(decimals)));
      }
    };

    startTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, decimals, enabled]);

  return value;
}
