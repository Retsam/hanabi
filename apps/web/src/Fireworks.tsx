import { useEffect, useRef } from "react";
import { draw, newShow, showOver, step } from "./fireworks.ts";

/** The suit colors, read from the page's CSS variables so the fireworks match the cards. */
const SUIT_VARS = ["--red", "--yellow", "--green", "--blue", "--purple"];

/**
 * Full-screen fireworks over the page, for a perfect score. Ends by itself after a few seconds, or
 * on a click or key press; either way it calls `onDone`. Draws nothing for players who prefer
 * reduced motion.
 */
export function Fireworks({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduceMotion) {
      onDone();
      return undefined;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;

    const scale = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    const style = getComputedStyle(document.documentElement);
    const colors = SUIT_VARS.map((name) => style.getPropertyValue(name).trim() || "white");
    const show = newShow(width, height, colors);

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Cap the step so a backgrounded tab doesn't fire everything at once when it comes back.
      step(show, Math.min(0.05, (now - last) / 1000));
      last = now;
      draw(ctx, show);
      if (showOver(show)) onDone();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const dismiss = () => onDone();
    window.addEventListener("keydown", dismiss);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", dismiss);
    };
  }, [onDone, reduceMotion]);

  if (reduceMotion) return null;
  return (
    <div className="fireworks" onClick={onDone} aria-hidden="true">
      <canvas ref={canvasRef} />
      <p>Perfect score! Click or press any key to dismiss.</p>
    </div>
  );
}
