// Confetti from a button, for the moments something is actually decided:
// a version saved, a proposal accepted. Drawn on one canvas over the page
// at the display's own refresh rate and pixel density, every motion timed
// by the frame clock rather than by frames, so it moves the same at 60 Hz
// and at 144. Nothing here takes input, and someone who asked their system
// for less motion sees none.

/** What a burst starts from: the box of the thing that was pressed. */
export interface Origin {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Turn in the plane, and its speed. */
  angle: number;
  spin: number;
  /** The flip through the third dimension, and its speed. */
  tilt: number;
  flip: number;
  /** The flutter that sways a falling piece side to side. */
  wobble: number;
  sway: number;
  w: number;
  h: number;
  color: string;
  round: boolean;
  life: number;
  lived: number;
}

// Bright on light and dark alike; the violet is the agents' own.
const COLORS = ["#7c3aed", "#2563eb", "#059669", "#f59e0b", "#e11d48", "#06b6d4", "#facc15"];
const COUNT = 140;
const GRAVITY = 1400; // px/s²
const DRAG = 2.6; // 1/s
const TERMINAL = 520; // px/s

/** Whether this person asked for less motion. */
function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function pieces(o: Origin, rand: () => number): Piece[] {
  const cx = o.left + o.width / 2;
  const cy = o.top + o.height / 2;
  const out: Piece[] = [];
  for (let i = 0; i < COUNT; i++) {
    // Up and out in a fan, wider than it is tall, from anywhere on the button.
    const a = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 0.95;
    const speed = 520 + rand() * 640;
    out.push({
      x: cx + (rand() - 0.5) * o.width * 0.8,
      y: cy + (rand() - 0.5) * o.height * 0.4,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      angle: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 14,
      tilt: rand() * Math.PI * 2,
      flip: 6 + rand() * 10,
      wobble: rand() * Math.PI * 2,
      sway: 3 + rand() * 5,
      w: 6 + rand() * 6,
      h: 3 + rand() * 4,
      color: COLORS[Math.floor(rand() * COLORS.length)],
      round: rand() < 0.25,
      life: 1.6 + rand() * 0.9,
      lived: 0,
    });
  }
  return out;
}

/** Moves every piece on by dt seconds; false once all are spent. */
export function advance(ps: Piece[], dt: number, height: number): boolean {
  let alive = false;
  const slow = Math.exp(-DRAG * dt);
  for (const p of ps) {
    if (p.lived >= p.life) continue;
    p.lived += dt;
    p.vx *= slow;
    p.vy = Math.min(p.vy * slow + GRAVITY * dt, TERMINAL);
    p.wobble += p.sway * dt;
    p.x += (p.vx + Math.sin(p.wobble) * 40) * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
    p.tilt += p.flip * dt;
    if (p.y > height + 40) p.lived = p.life;
    if (p.lived < p.life) alive = true;
  }
  return alive;
}

function draw(ctx: CanvasRenderingContext2D, ps: Piece[]) {
  for (const p of ps) {
    if (p.lived >= p.life) continue;
    // Fades only in its last third, so a burst reads as a burst.
    const left = 1 - p.lived / p.life;
    ctx.globalAlpha = Math.min(1, left * 3);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // A flip through the third dimension: the piece narrows to an edge and
    // turns over, a shade darker on its back.
    const face = Math.cos(p.tilt);
    ctx.scale(1, Math.max(0.08, Math.abs(face)));
    ctx.fillStyle = p.color;
    if (p.round) {
      ctx.beginPath();
      ctx.arc(0, 0, p.h, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    if (face < 0) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      if (p.round) ctx.fill();
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * One burst of confetti out of the box o, over everything and in the
 * way of nothing. Returns at once; the canvas removes itself when the
 * last piece has fallen.
 */
export function confetti(o: Origin, rand: () => number = Math.random): void {
  if (typeof document === "undefined" || reducedMotion()) return;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.slot = "confetti";
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "100" });
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  document.body.appendChild(canvas);
  window.addEventListener("resize", fit);

  const ps = pieces(o, rand);
  let last: number | undefined;
  const frame = (now: number) => {
    // A tab in the background gets no frames; a long gap is one short step,
    // not a jump.
    const dt = last === undefined ? 1 / 120 : Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const alive = advance(ps, dt, window.innerHeight);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!alive) {
      window.removeEventListener("resize", fit);
      canvas.remove();
      return;
    }
    draw(ctx, ps);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
