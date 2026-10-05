import { useEffect, useLayoutEffect, useRef } from "react";

type Box = { left: number; top: number; width: number; height: number };

const random = () => Math.random();
const waves = (n: number, amp: number) => Array.from({ length: n }, () => ({ f: 0.07 + random() * 0.22, p: random() * 6.28, a: amp * (0.5 + random() * 0.5) }));
const sum = (ws: { f: number; p: number; a: number }[], t: number) => ws.reduce((s, w) => s + w.a * Math.sin(w.f * t * 6.28 + w.p), 0);

/**
 * The tour's guide: a soft, translucent warm light resting at the top
 * right corner of what the step is about, hovering there as a pixie would.
 * Its drift is a few slow waves at unrelated speeds, so it never repeats,
 * and it eases after where they point rather than sitting on it, so every
 * turn is soft; moving to the next thing, it glides there. Less motion: it
 * rests on the corner, still, and follows the setting if it changes.
 */
export function Pixie({ box }: { box: Box }) {
  const dot = useRef<HTMLSpanElement>(null);
  const trail = useRef<(HTMLSpanElement | null)[]>([]);
  // Where it should be, read each frame without restarting the drift.
  const target = useRef(box);
  useLayoutEffect(() => {
    target.current = box;
  }, [box]);

  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const wx = waves(3, 2.4);
    const wy = waves(3, 2.2);
    const glow = waves(2, 1);
    let at: [number, number] | null = null;
    const hist: [number, number][] = [];
    let last = 0;
    let frame = 0;
    const tick = (ms: number) => {
      const t = ms / 1000;
      const dt = Math.min(0.05, last ? t - last : 0.016);
      last = t;
      const still = !!motion?.matches;
      const b = target.current;
      // The top right corner, kept on the screen.
      const cx = Math.min(b.left + b.width + 2, window.innerWidth - 10);
      const cy = Math.max(b.top - 2, 10);
      const want: [number, number] = still ? [cx, cy] : [cx + sum(wx, t), cy + sum(wy, t)];
      if (!at || still) at = [...want];
      else {
        // Gliding to a new place is quicker than drifting about one.
        const far = Math.hypot(want[0] - at[0], want[1] - at[1]) > 24;
        const k = 1 - Math.exp(-dt * (far ? 4 : 2.2));
        at = [at[0] + (want[0] - at[0]) * k, at[1] + (want[1] - at[1]) * k];
      }
      const el = dot.current;
      if (el) {
        el.style.transform = `translate(${at[0].toFixed(2)}px, ${at[1].toFixed(2)}px)`;
        el.style.opacity = still ? "0.7" : (0.62 + 0.14 * (0.5 + 0.5 * Math.sin(t * 0.9 + sum(glow, t * 0.3)))).toFixed(3);
      }
      hist.unshift(at);
      hist.length = Math.min(hist.length, 30);
      trail.current.forEach((tr, i) => {
        if (!tr) return;
        const h = hist[(i + 1) * 12] ?? at!;
        tr.style.transform = `translate(${h[0].toFixed(2)}px, ${h[1].toFixed(2)}px)`;
        tr.style.opacity = still ? "0" : String([0.35, 0.18][i]);
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div aria-hidden="true" data-slot="tour-pixie">
      {[0, 1].map((i) => (
        <span
          key={i}
          ref={(el) => {
            trail.current[i] = el;
          }}
          className="absolute left-0 top-0 -m-0.5 size-1 rounded-full bg-[rgb(255_190_120/0.55)] shadow-[0_0_6px_2px_rgb(255_170_90/0.18)] will-change-transform"
          style={{ opacity: 0 }}
        />
      ))}
      <span
        ref={dot}
        className="absolute left-0 top-0 -m-1 size-2 rounded-full will-change-transform"
        style={{
          opacity: 0.7,
          background: "radial-gradient(circle, rgb(255 250 235 / 0.95) 0 25%, rgb(255 190 110 / 0.85) 55%, rgb(255 160 70 / 0) 100%)",
          boxShadow: "0 0 10px 4px rgb(255 170 80 / 0.28), 0 0 22px 10px rgb(255 160 70 / 0.12)",
        }}
      />
    </div>
  );
}
