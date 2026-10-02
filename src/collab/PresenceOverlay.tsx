import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

import type { Peer, SharedDraft } from "@/client/port";
import { caretPoint } from "./mirror";
import { displayName } from "./names";
import { peersHere, usePresence } from "./presenceContext";
import { byAttr, onScreen, useRelayout } from "./relayout";

/** What a pointer target names: a field first, then a region. */
function targetOf(key: string): Element | null {
  const el = byAttr("data-cartograph-field", key) ?? byAttr("data-cartograph-region", key);
  // Only the page is shared; a pointer said to be on the rail, from a
  // client before 2.5.1, stays there.
  return el?.closest('[data-cartograph-region="main"]') ? el : null;
}

/** The text control a field is; a wrapper around one is not its text. */
function textControlIn(el: Element): HTMLInputElement | HTMLTextAreaElement | null {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
}

const layer: CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" };

function NameChip({ peer, style }: { peer: Peer; style: CSSProperties }) {
  return (
    <span
      className="absolute max-w-48 truncate rounded px-1.5 py-0.5 text-xs font-medium text-white shadow-sm"
      style={{ backgroundColor: peer.color, ...style }}
    >
      {displayName(peer)}
    </span>
  );
}

/** A coloured ring and a name on the field another session is in. */
function FieldRing({ peer, index }: { peer: Peer; index: number }) {
  const el = peer.focus ? byAttr("data-cartograph-field", peer.focus.path) : null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!onScreen(r)) return null;
  // A second ring on the same field sits just outside the first.
  const pad = 2 + index * 3;
  return (
    <div
      data-slot="presence-ring"
      data-session={peer.session}
      data-field={peer.focus?.path}
      className="absolute rounded-md"
      style={{
        left: r.left - pad,
        top: r.top - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
        boxShadow: `0 0 0 2px ${peer.color}`,
      }}
    >
      {/* At the ring's right end: a field's label sits at its left, and a
          presence mark must never hide what it marks. */}
      <NameChip peer={peer} style={{ right: 0, bottom: "100%", marginBottom: 2 }} />
    </div>
  );
}

/** Another session's caret, or selection, inside a text field. */
function RemoteCaret({ peer, draft }: { peer: Peer; draft: SharedDraft }) {
  const caret = peer.caret;
  const field = caret ? byAttr("data-cartograph-field", caret.path) : null;
  const control = field ? textControlIn(field) : null;
  if (!caret || !control) return null;
  const anchor = draft.cursorPosition(caret.path, caret.anchor);
  const head = draft.cursorPosition(caret.path, caret.head);
  if (anchor === undefined || head === undefined) return null;
  const box = control.getBoundingClientRect();
  if (!onScreen(box)) return null;
  const start = Math.min(anchor, head);
  const end = Math.max(anchor, head);
  const at = caretPoint(control, head);
  const from = caretPoint(control, start);
  const to = caretPoint(control, end);
  const inside = (left: number) => Math.min(Math.max(left, 0), box.width);
  const rects: CSSProperties[] = [];
  if (start !== end) {
    if (from.top === to.top) {
      rects.push({ left: inside(from.left), top: from.top, width: Math.max(0, inside(to.left) - inside(from.left)), height: from.height });
    } else {
      // Across lines: the rest of the first, every line between, the start of the last.
      rects.push({ left: inside(from.left), top: from.top, right: 0, height: from.height });
      if (to.top - from.top > from.height) {
        rects.push({ left: 0, top: from.top + from.height, right: 0, height: to.top - from.top - from.height });
      }
      rects.push({ left: 0, top: to.top, width: inside(to.left), height: to.height });
    }
  }
  return (
    <div
      data-slot="presence-caret"
      data-session={peer.session}
      className="absolute overflow-hidden"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      {rects.map((style, i) => (
        <span key={i} className="absolute opacity-25" style={{ ...style, backgroundColor: peer.color }} />
      ))}
      <span
        className="absolute w-0.5"
        style={{ left: inside(at.left), top: at.top, height: at.height, backgroundColor: peer.color }}
      />
    </div>
  );
}

/** Another session's pointer, over the same thing it is over there. */
function RemotePointer({ peer }: { peer: Peer }) {
  const pointer = peer.pointer;
  const el = pointer ? targetOf(pointer.target) : null;
  if (!pointer || !el) return null;
  const r = el.getBoundingClientRect();
  if (!onScreen(r)) return null;
  const x = r.left + pointer.x * r.width;
  const y = r.top + pointer.y * r.height;
  return (
    <div
      data-slot="presence-pointer"
      data-session={peer.session}
      data-target={pointer.target}
      className="absolute left-0 top-0 motion-safe:transition-transform motion-safe:duration-100 motion-safe:ease-linear"
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true" className="drop-shadow-sm">
        <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill={peer.color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <NameChip peer={peer} style={{ left: 14, top: 16 }} />
    </div>
  );
}

/**
 * Everyone else on this screen, drawn over it: a ring on the field each is
 * in, their caret inside text, and their pointer. One fixed layer that
 * takes no pointer events, so nothing here ever stands in the way of input.
 */
export function PresenceOverlay() {
  const presence = usePresence();
  const { draft } = presence;
  const peers = peersHere(presence);
  useRelayout(peers.length > 0);
  if (peers.length === 0 || typeof document === "undefined") return null;
  const ringsOn = new Map<string, number>();
  return createPortal(
    <div data-slot="presence-overlay" aria-hidden="true" style={layer}>
      {peers.map((peer) => {
        const path = peer.focus?.path ?? "";
        const index = ringsOn.get(path) ?? 0;
        ringsOn.set(path, index + 1);
        return (
          <div key={peer.session}>
            <FieldRing peer={peer} index={index} />
            {draft ? <RemoteCaret peer={peer} draft={draft} /> : null}
            <RemotePointer peer={peer} />
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
