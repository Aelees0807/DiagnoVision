import { useEffect, useRef, useMemo } from 'react';

/**
 * Subtle animated particle field using Canvas.
 * Renders floating medical-themed dots that drift slowly.
 * Respects prefers-reduced-motion and is purely decorative.
 * @param {{ count?: number, className?: string }} props
 */
export default function ParticleField({ count = 35, className = '' }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Generate stable random particles only once
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2.5 + 1,
      speedX: (Math.random() - 0.5) * 0.15,
      speedY: (Math.random() - 0.5) * 0.1 - 0.05,
      opacity: Math.random() * 0.3 + 0.15,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.01 + 0.005,
    }));
  }, [count]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const color = { r: 30, g: 107, b: 138 }; // --color-primary #1E6B8A

    const animate = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;

      ctx.clearRect(0, 0, w, h);

      particles.forEach((p) => {
        // Update position
        p.x += p.speedX / w;
        p.y += p.speedY / h;
        p.pulse += p.pulseSpeed;

        // Wrap around edges
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05;
        if (p.y > 1.05) p.y = -0.05;

        const px = p.x * w;
        const py = p.y * h;
        const pulseFactor = 0.5 + 0.5 * Math.sin(p.pulse);
        const alpha = p.opacity * (0.6 + 0.4 * pulseFactor);

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        ctx.fill();
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [particles]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
