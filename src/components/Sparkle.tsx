import { Sparkle } from "lucide-react";
import type { CSSProperties } from "react";

/** Eight directions, alternating near and far, so the burst reads as a
 * sparkle rather than a ring. */
const POINTS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2 + 0.3;
  const reach = i % 2 === 0 ? 26 : 16;
  return { dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach, turn: (i % 2 === 0 ? 1 : -1) * 90, size: i % 2 === 0 ? 10 : 7 };
});

/**
 * A short sparkle out of whatever it sits in (which must be positioned):
 * the mark of something just named, as confetti is the mark of something
 * finished (components/celebrate). Plays once, when it mounts; nothing for
 * someone who asked for less motion.
 */
export function SparkleBurst() {
  return (
    <span aria-hidden="true" data-slot="sparkle-burst">
      {POINTS.map((p, i) => (
        <Sparkle
          key={i}
          className="cartograph-sparkle fill-current"
          style={{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--turn": `${p.turn}deg`, width: p.size, height: p.size, animationDelay: `${i * 18}ms` } as CSSProperties}
        />
      ))}
    </span>
  );
}
