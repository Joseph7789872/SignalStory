"use client";

import { useEffect, useRef } from "react";

// Noisy grey traces on the left resolve into one clean blue line on the
// right — noise -> signal, the product thesis drawn rather than decorated.
const TRACES = [
  { hue: "rgba(124,140,165,0.35)", amp: 26, freq: 0.021, phase: 0.0, speed: 0.016 },
  { hue: "rgba(124,140,165,0.28)", amp: 34, freq: 0.014, phase: 2.1, speed: 0.011 },
  { hue: "rgba(124,140,165,0.22)", amp: 20, freq: 0.03, phase: 4.2, speed: 0.021 },
  { hue: "rgba(56,189,248,0.95)", amp: 24, freq: 0.017, phase: 1.3, speed: 0.014 },
] as const;

export function SignalCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let t = 0;
    let raf = 0;

    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const mid = H * 0.52;

      TRACES.forEach((tr, i) => {
        const isSignal = i === TRACES.length - 1;
        ctx.beginPath();
        ctx.lineWidth = isSignal ? 2 : 1.25;
        ctx.strokeStyle = tr.hue;
        for (let x = 0; x <= W; x += 3) {
          // damp(x): 1 at the left edge -> 0 at the right, so chaos settles.
          const damp = Math.pow(1 - x / W, 1.6);
          const noise =
            Math.sin(x * tr.freq + tr.phase + t * tr.speed * 60) * tr.amp +
            Math.sin(x * tr.freq * 2.7 + tr.phase * 3 + t * tr.speed * 90) *
              tr.amp *
              0.4;
          const y = mid + noise * damp * (isSignal ? 0.9 : 1);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // Endpoint: the resolved signal.
      ctx.beginPath();
      ctx.arc(W - 14, mid, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56,189,248,1)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(W - 14, mid, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56,189,248,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    window.addEventListener("resize", resize);
    resize();

    if (reduced) {
      t = 12; // one static, settled frame
      draw();
    } else {
      const loop = () => {
        t += 0.016;
        draw();
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
