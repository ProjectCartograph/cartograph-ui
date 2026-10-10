// The one people's trace for the window, and what records into it: the
// listeners on the page (presses and their answer time, answers given,
// waits) and the shared components (the flow shell, the pickers, the
// not-found page), so a screen built from them is measured without
// doing anything itself.

import { activeChangeSet } from "@/client/active";
import { newSession } from "@/client/presence";
import type { Client } from "@/client/port";
import { PeopleTrace, type Act } from "./trace";

export type { Act } from "./trace";

let current: PeopleTrace | undefined;

/** Whether this window records its acts. */
export function traceOn(): boolean {
  return current?.enabled === true;
}

/** Records an act; nothing until the trace has started and is on. */
export function act(a: Act): void {
  current?.act(a);
}

/** Elements a press on means something. */
const ACTIONABLE =
  'button, a[href], input, select, textarea, label, summary, [role="button"], [role="link"], [role="option"], [role="tab"], ' +
  '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="checkbox"], [role="radio"], [role="switch"], ' +
  '[role="combobox"], [role="slider"], [tabindex]:not([tabindex="-1"]), [data-cartograph-field], [contenteditable="true"]';

/** Choices that answer the field they sit in when pressed. */
const ANSWERS = '[role="radio"], [role="option"], [role="checkbox"], [role="switch"], [role="menuitemradio"], [role="menuitemcheckbox"]';

/** Something on the screen says it is waiting. */
export function waitShown(doc: Document = document): boolean {
  return doc.querySelector('[data-slot="skeleton"], [aria-busy="true"]') !== null;
}

function fieldOf(el: Element | null): string | undefined {
  return el?.closest("[data-cartograph-field]")?.getAttribute("data-cartograph-field") ?? undefined;
}

/** The flow the person is in, so an answer names its record and step. */
let flow: { kind: string; record: string; step: string } | undefined;

/** An option was chosen while a picker was open. */
let chose = false;

/**
 * Starts the window's trace: asks the session whether to record, and only
 * then listens. Returns a function that stops it.
 */
export async function startTrace(client: Client, surface: () => string): Promise<() => void> {
  const t = new PeopleTrace(client, { session: newSession(), surface });
  if (!(await t.start())) return () => {};
  current = t;

  const onClick = (e: MouseEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    const actionable = target?.closest(ACTIONABLE) ?? null;
    const field = fieldOf(target);
    if (target?.closest('[data-slot="field-help"], [data-slot="field-examples"]')) guideOpened(field);
    if (target?.closest(ANSWERS)) {
      chose = true;
      if (field && flow) act({ name: "field.set", ...flow, field });
    }
    // The answer is the next frame the browser draws after the press is
    // handled: under 100 ms feels like direct manipulation (DESIGN_RULES.md,
    // "The interface answers").
    const t0 = e.timeStamp || performance.now();
    requestAnimationFrame(() =>
      setTimeout(() => {
        act({ name: "press", target: actionable ? "action" : "none", field, step: flow?.step, millis: performance.now() - t0 });
      }, 0),
    );
  };
  // A text answer is given when it is left changed, never per key.
  const onChange = (e: Event) => {
    const field = fieldOf(e.target instanceof Element ? e.target : null);
    if (field && flow) act({ name: "field.set", ...flow, field });
  };
  // A choice in a picker can close it before its click arrives.
  const onPointerUp = (e: PointerEvent) => {
    if (e.target instanceof Element && e.target.closest(ANSWERS)) chose = true;
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") void t.flush();
  };
  let set = activeChangeSet.get();
  const stopSets = activeChangeSet.subscribe(() => {
    const next = activeChangeSet.get();
    // A switch is from one change set to another, not starting the first
    // or leaving one that was rolled in.
    if (set && next && next !== set) act({ name: "changeset.switch", changeSet: next });
    set = next;
  });
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("visibilitychange", onHide);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("visibilitychange", onHide);
    stopSets();
    void t.flush();
    current = undefined;
  };
}

/**
 * Times a screen from the navigation to its content: until nothing on it
 * says it is waiting, at most thirty seconds, and whether anything did.
 */
export function screenShown(started: number): void {
  if (!current?.enabled) return;
  let sign = false;
  const surface = current.surface();
  const look = () => {
    const waiting = waitShown();
    sign ||= waiting;
    const ms = performance.now() - started;
    if (waiting && ms < 30_000) {
      requestAnimationFrame(look);
      return;
    }
    act({ name: "screen.show", surface, millis: ms, sign });
  };
  requestAnimationFrame(look);
}

/**
 * Times a request: the answer's time and outcome, and whether the screen
 * showed it was waiting once a second had passed.
 */
export function requestStarted(url: string): (status: number | undefined) => void {
  if (!current?.enabled || url.includes("/events")) return () => {};
  const t0 = performance.now();
  let sign = false;
  const check = setTimeout(() => {
    sign = waitShown();
  }, 1000);
  return (status) => {
    clearTimeout(check);
    const outcome = status === undefined || status >= 500 ? "failed" : status >= 400 ? "refused" : "ok";
    act({ name: "request", millis: performance.now() - t0, outcome, sign });
  };
}

/** The flow shell says which record and step the person is on. */
export function inFlow(kind: string, record: string, step: string, index: number, opened: boolean, existing: boolean | undefined): void {
  if (!current?.enabled) return;
  if (opened) act({ name: "flow.open", kind, record, target: existing === undefined ? undefined : existing ? "existing" : "new" });
  else if (flow && flow.record === record && index < flowIndex) act({ name: "step.back", kind, record, step: flow.step });
  flow = { kind, record, step };
  flowIndex = index;
  act({ name: "step.enter", kind, record, step });
}
let flowIndex = 0;

/** The flow shell is gone. */
export function leftFlow(record: string): void {
  if (flow?.record === record) flow = undefined;
}

/** A field's guide or examples opened. */
export function guideOpened(field?: string): void {
  if (flow) act({ name: "guide.open", ...flow, field });
}

/**
 * Wraps a picker's onOpenChange: an open, and a close that says whether
 * anything was chosen while it was open.
 */
export function tracePicker<A extends unknown[]>(handler?: (open: boolean, ...rest: A) => void) {
  return (open: boolean, ...rest: A) => {
    if (open) {
      chose = false;
      act({ name: "picker.open", step: flow?.step });
    } else {
      act({ name: "picker.close", step: flow?.step, target: chose ? "chosen" : "none" });
    }
    handler?.(open, ...rest);
  };
}

/** For tests: forget the window's trace. */
export function resetTrace(): void {
  current = undefined;
  flow = undefined;
  chose = false;
}
