// The presence payload (contract/schemas/presence.schema.json) and the
// rules its descriptions set: a heartbeat at least every three seconds, the
// pointer at most twenty times a second, a session forgotten after ten
// seconds of silence, and leaving=true when a screen closes. Pure, so the
// rules are tested without a network.

import type { Peer, PresenceAgent, PresenceCaret, PresenceFocus, PresencePointer, PresenceState } from "./port";

/** The repeat while a screen is open. */
export const HEARTBEAT_MS = 3000;
/** The least time between two pointer messages (twenty a second). */
export const POINTER_MS = 50;
/** A session silent this long has gone. */
export const EXPIRY_MS = 10_000;

/** One message, exactly as the schema has it. */
export interface PresenceMessage {
  v: 1;
  session: string;
  actor: string;
  name?: string;
  color?: string;
  route?: string;
  focus?: PresenceFocus | null;
  caret?: PresenceCaret | null;
  pointer?: PresencePointer | null;
  at: number;
  leaving?: boolean;
  agent?: PresenceAgent;
}

const TOP = new Set(["v", "session", "actor", "name", "color", "route", "focus", "caret", "pointer", "at", "leaving", "agent"]);
const STEPS = ["guide", "read", "draft", "checks", "propose"];
const AGENT = ["for", "seq", "step", "kind", "id", "name", "fields", "met", "open", "proposal", "parts", "changeSet"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max: number, min = 0): v is string {
  return typeof v === "string" && v.length >= min && v.length <= max;
}

function only(o: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(o).every((k) => keys.includes(k));
}

function unit(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

function validFocus(v: unknown): boolean {
  return v === null || (isRecord(v) && only(v, ["path"]) && str(v.path, 512));
}

function validCaret(v: unknown): boolean {
  return (
    v === null ||
    (isRecord(v) && only(v, ["path", "anchor", "head"]) && str(v.path, 512) && str(v.anchor, 256) && str(v.head, 256))
  );
}

function validPointer(v: unknown): boolean {
  return v === null || (isRecord(v) && only(v, ["target", "x", "y"]) && str(v.target, 512) && unit(v.x) && unit(v.y));
}

function count(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function validAgent(v: unknown): boolean {
  if (!isRecord(v) || !only(v, AGENT)) return false;
  if (!str(v.for, 256) || !count(v.seq) || !STEPS.includes(v.step as string)) return false;
  if (v.kind !== undefined && !str(v.kind, 64)) return false;
  if (v.id !== undefined && !str(v.id, 128)) return false;
  if (v.name !== undefined && !str(v.name, 256)) return false;
  if (v.fields !== undefined && !(Array.isArray(v.fields) && v.fields.length <= 32 && v.fields.every((f) => str(f, 512)))) return false;
  for (const k of ["met", "open", "parts"] as const) if (v[k] !== undefined && !count(v[k])) return false;
  if (v.proposal !== undefined && !str(v.proposal, 64)) return false;
  if (v.changeSet !== undefined && !str(v.changeSet, 64)) return false;
  return true;
}

/** Whether a received message is one the schema allows. Anything else is
 * dropped: presence is lossy by design, and the next message replaces it. */
export function isPresenceMessage(m: unknown): m is PresenceMessage {
  if (!isRecord(m) || !Object.keys(m).every((k) => TOP.has(k))) return false;
  if (m.v !== 1) return false;
  if (!str(m.session, 64, 8) || !str(m.actor, 256)) return false;
  if (m.name !== undefined && !str(m.name, 128)) return false;
  if (m.color !== undefined && !(typeof m.color === "string" && /^#[0-9a-fA-F]{6}$/.test(m.color))) return false;
  if (m.route !== undefined && !str(m.route, 512)) return false;
  if (m.focus !== undefined && !validFocus(m.focus)) return false;
  if (m.caret !== undefined && !validCaret(m.caret)) return false;
  if (m.pointer !== undefined && !validPointer(m.pointer)) return false;
  if (typeof m.at !== "number" || !Number.isInteger(m.at) || m.at < 0) return false;
  if (m.leaving !== undefined && typeof m.leaving !== "boolean") return false;
  if (m.agent !== undefined && !validAgent(m.agent)) return false;
  return true;
}

/**
 * Colours that read on a light and on a dark background alike, so a
 * sender's choice draws the same on every screen.
 */
export const PALETTE = [
  "#2563eb",
  "#db2777",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#4d7c0f",
] as const;

/** A stable colour for a principal: the same actor, the same colour. */
export function colorFor(actor: string): string {
  // FNV-1a: small, stable and spreads short strings well.
  let h = 0x811c9dc5;
  for (let i = 0; i < actor.length; i++) {
    h ^= actor.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return PALETTE[(h >>> 0) % PALETTE.length];
}

/** A session id: random, fixed for the life of the tab. */
export function newSession(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Who is sending, fixed for the channel's life. */
export interface Sender {
  session: string;
  actor: string;
  name?: string;
  color: string;
}

/** The message for a state, as the schema has it. */
export function messageFor(me: Sender, state: PresenceState, at: number, leaving = false): PresenceMessage {
  return {
    v: 1,
    session: me.session,
    actor: me.actor,
    ...(me.name ? { name: me.name } : {}),
    color: me.color,
    ...(state.route !== undefined ? { route: state.route } : {}),
    focus: state.focus ?? null,
    caret: state.caret ?? null,
    pointer: state.pointer ?? null,
    at: Math.max(0, Math.floor(at)),
    ...(leaving ? { leaving: true } : {}),
  };
}

/**
 * The live set of other sessions, as messages arrive and time passes. A
 * message older than the last one heard from its session is ignored, so a
 * reordered relay cannot move someone backwards.
 */
export class PeerSet {
  private readonly peers = new Map<string, Peer & { at: number }>();
  private readonly self: string;

  constructor(self: string) {
    this.self = self;
  }

  /** Takes one message in; true when the set changed. */
  receive(m: unknown, now: number): boolean {
    if (!isPresenceMessage(m) || m.session === this.self) return false;
    const known = this.peers.get(m.session);
    if (known && m.at < known.at) return false;
    if (m.leaving) return this.peers.delete(m.session);
    this.peers.set(m.session, {
      session: m.session,
      actor: m.actor,
      ...(m.name ? { name: m.name } : {}),
      color: m.color ?? colorFor(m.actor),
      ...(m.route !== undefined ? { route: m.route } : {}),
      focus: m.focus ?? null,
      caret: m.caret ?? null,
      pointer: m.pointer ?? null,
      ...(m.agent ? { agent: m.agent } : {}),
      heard: now,
      at: m.at,
    });
    return true;
  }

  /** Forgets every session silent for EXPIRY_MS; true when any went. */
  expire(now: number): boolean {
    let changed = false;
    for (const [session, peer] of this.peers) {
      if (now - peer.heard >= EXPIRY_MS) {
        this.peers.delete(session);
        changed = true;
      }
    }
    return changed;
  }

  list(): Peer[] {
    return [...this.peers.values()].map(({ at: _at, ...peer }) => peer);
  }
}
