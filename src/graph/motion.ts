// How the workspace graph moves while a person handles it. Where each node
// starts is the engine's (GET /graph); this only animates what a hand does
// to it, the way Obsidian's graph moves. Every edge is a spring whose rest
// length is its length in the engine's layout, and every node is held
// lightly where it rests, so dragging one pulls what it is linked to
// along, the pull fading outward. A node stays where it is dropped, and
// what it pulled stays where it settled: wherever things come to rest
// becomes where they rest, until the graph is loaded again.

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Held under the pointer. */
  held?: boolean;
  /** Dropped by a hand, and staying there. */
  pinned?: boolean;
}

export interface Spring {
  s: number;
  t: number;
  /** Its length in the engine's layout. */
  rest: number;
}

const HOME = 0.006; // towards where it rests
const PULL = 0.06; // along an edge
const DAMP = 0.7; // what is left of a node's speed each frame
const STILL = 0.004; // slower than this, a node is at rest

/** The springs of a graph laid out at home. */
export function springs(home: readonly { x: number; y: number }[], edges: readonly { s: number; t: number }[]): Spring[] {
  return edges.map((e) => ({ ...e, rest: Math.hypot(home[e.t].x - home[e.s].x, home[e.t].y - home[e.s].y) }));
}

/** One step; returns how much is still moving. */
export function step(bodies: Body[], home: readonly { x: number; y: number }[], links: readonly Spring[]): number {
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    b.vx += (home[i].x - b.x) * HOME;
    b.vy += (home[i].y - b.y) * HOME;
  }
  for (const l of links) {
    const a = bodies[l.s];
    const b = bodies[l.t];
    const x = b.x - a.x;
    const y = b.y - a.y;
    const d = Math.hypot(x, y) || 0.01;
    const f = (d - l.rest) * PULL;
    const fx = (x / d) * f;
    const fy = (y / d) * f;
    a.vx += fx / 2;
    a.vy += fy / 2;
    b.vx -= fx / 2;
    b.vy -= fy / 2;
  }
  let moving = 0;
  for (const b of bodies) {
    if (b.held || b.pinned) {
      b.vx = b.vy = 0;
      continue;
    }
    b.vx *= DAMP;
    b.vy *= DAMP;
    // At rest is at rest: no creeping by fractions of a pixel.
    if (Math.abs(b.vx) < STILL && Math.abs(b.vy) < STILL) {
      b.vx = b.vy = 0;
      continue;
    }
    b.x += b.vx;
    b.y += b.vy;
    moving += Math.abs(b.vx) + Math.abs(b.vy);
  }
  return moving;
}

/** Where things came to rest becomes where they rest, and how far apart
 * linked things are becomes how far apart they stay. */
export function restHere(bodies: readonly Body[], home: { x: number; y: number }[], links: Spring[]) {
  bodies.forEach((b, i) => {
    home[i] = { x: b.x, y: b.y };
  });
  for (const l of links) l.rest = Math.hypot(bodies[l.t].x - bodies[l.s].x, bodies[l.t].y - bodies[l.s].y);
}
