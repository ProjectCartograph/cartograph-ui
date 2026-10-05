// Celebrates one moment: a definition completed, its version saved from
// the button that says so. Drafts save themselves all the time, and a
// record named in passing (a gap added while starting a project) saves a
// version too; neither is a definition completed, so confetti is opt-in:
// only a button marked data-celebrate earns it, pressed in the moments
// before the call that succeeded, and it comes out of that button, or out
// of where it was if the dialog it sat in has closed since. What is merely
// new gets a sparkle instead (components/Sparkle).

import type { Client } from "@/client/port";
import { confetti, type Origin } from "./confetti";

/** How long after a press a success still counts as its result. */
const RECENT_MS = 20_000;

/** The client calls that commit something. */
const COMMITS = ["saveVersion", "snapshot", "transition", "apply", "acceptProposal"] as const;

let pressed: { el: Element; box: Origin; at: number } | undefined;

function onPress(e: Event) {
  if (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ") return;
  const el = e.target instanceof Element ? e.target.closest("button, [role=button], a[href]") : null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  pressed = { el, box: { left: r.left, top: r.top, width: r.width, height: r.height }, at: Date.now() };
}

let listening = false;
function listen() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("pointerdown", onPress, true);
  document.addEventListener("keydown", onPress, true);
}

/** A burst from the button just pressed, if one was. */
export function celebrate(now = Date.now()) {
  const p = pressed;
  pressed = undefined;
  if (!p || now - p.at > RECENT_MS || !p.el.closest("[data-celebrate]")) return;
  if (p.el.isConnected) {
    const r = p.el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      confetti({ left: r.left, top: r.top, width: r.width, height: r.height });
      return;
    }
  }
  confetti(p.box);
}

/** The client, with every commit that succeeds after a press celebrated. */
export function celebrating(client: Client): Client {
  listen();
  const out = { ...client } as Record<string, unknown>;
  for (const name of COMMITS) {
    const fn = (client as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[name];
    if (typeof fn !== "function") continue;
    out[name] = async (...args: unknown[]) => {
      const result = await fn.apply(client, args);
      celebrate();
      return result;
    };
  }
  return out as unknown as Client;
}
