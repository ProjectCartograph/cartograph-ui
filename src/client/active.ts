/**
 * The change set this window works in (engine docs/adr/0024): every edit
 * lands in it and every read shows the workspace as if it were rolled
 * in. Kept per browser, so a reload carries on in the same piece of work;
 * an unreadable store means none, and the next edit starts one.
 */
const KEY = "cartograph.changeSet";

let current: string | undefined = read();
// Seeing the record as it is, for a moment, without leaving the change
// set: reads leave it out; edits still go into it.
let asItIs = false;
// Set when the change set in hand was merged: what is worked on next
// starts a change set of its own rather than picking up an older one.
let mergedLast = false;
const listeners = new Set<() => void>();
const touched = new Set<() => void>();

// A link may name the change set to open in (?changeSet=), so a review
// can be shared; it is then the window's own.
function read(): string | undefined {
  try {
    const linked = new URLSearchParams(window.location.search).get("changeSet");
    if (linked) {
      window.localStorage.setItem(KEY, linked);
      return linked;
    }
    return window.localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export const activeChangeSet = {
  get: (): string | undefined => current,
  /** The change set reads show the workspace through, unless the person
   * is looking at it as it is. */
  shown: (): string | undefined => (asItIs ? undefined : current),
  asItIs: (): boolean => asItIs,
  setAsItIs(on: boolean) {
    if (on === asItIs) return;
    asItIs = on;
    for (const l of listeners) l();
  },
  set(id: string | undefined) {
    if (id === current) return;
    current = id;
    asItIs = false;
    try {
      if (id) window.localStorage.setItem(KEY, id);
      else window.localStorage.removeItem(KEY);
    } catch {
      // Not kept across a reload; the window still works in it.
    }
    for (const l of listeners) l();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Says a record was just put in the change set, for what shows its
   * contents to read it again. */
  /** Marks the active change set merged and leaves it. */
  merged() {
    mergedLast = true;
    this.set(undefined);
  },
  /** Whether the last change set was merged, and so the next is new. */
  takeMerged(): boolean {
    const was = mergedLast;
    mergedLast = false;
    return was;
  },
  touch() {
    for (const l of touched) l();
  },
  onTouch(listener: () => void): () => void {
    touched.add(listener);
    return () => touched.delete(listener);
  },
};
