// Keeping the local caret where it was while someone else's edit lands.
//
// A controlled input whose value is replaced from outside puts its caret at
// the end. When a remote change arrives the field on screen is about to be
// replaced with the merged text, so the selection is carried across the
// change first (by Automerge cursor in a text field, by the edit's extent
// in any other) and put back after React has committed the new value.

import type { DraftChange } from "@/client/port";

/** The focused control that edits a manifest field, if any. */
export function focusedField(): { el: HTMLInputElement | HTMLTextAreaElement; path: string } | undefined {
  const el = typeof document === "undefined" ? null : document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return undefined;
  // The control itself names the field: a search box inside a picker is
  // within a field without being its text.
  const path = el.getAttribute("data-cartograph-field");
  return path ? { el, path } : undefined;
}

export interface KeptCaret {
  el: HTMLInputElement | HTMLTextAreaElement;
  value: string;
  start: number;
  end: number;
  direction: "forward" | "backward" | "none";
}

/**
 * Where a position in `before` sits in `after`, for a single edit: unchanged
 * ahead of the edit, shifted by its length behind it, and at the end of the
 * inserted text inside it.
 */
export function shift(before: string, after: string, index: number): number {
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  )
    tail++;
  if (index <= head) return index;
  if (index >= before.length - tail) return index + (after.length - before.length);
  return after.length - tail;
}

/**
 * The selection of the focused field, carried across `change`, given what
 * the field will read after it. Undefined when nothing needs keeping.
 */
export function keepCaret(change: DraftChange, valueAt: (path: string) => unknown): KeptCaret | undefined {
  const focused = focusedField();
  if (!focused) return undefined;
  const { el, path } = focused;
  const next = valueAt(path);
  if (typeof next !== "string" || next === el.value) return undefined;
  let start: number | null;
  let end: number | null;
  try {
    start = el.selectionStart;
    end = el.selectionEnd;
  } catch {
    return undefined;
  }
  if (start === null || end === null) return undefined;
  const move = (i: number) => change.moved(path, i) ?? shift(el.value, next, i);
  return {
    el,
    value: next,
    start: move(start),
    end: move(end),
    direction: (el.selectionDirection as KeptCaret["direction"]) ?? "none",
  };
}

/** Puts a kept selection back, once the field shows the merged value. */
export function restoreCaret(kept: KeptCaret | undefined): void {
  if (!kept || document.activeElement !== kept.el || kept.el.value !== kept.value) return;
  try {
    kept.el.setSelectionRange(kept.start, kept.end, kept.direction);
  } catch {
    // A control with no selection (a number, a date) has nothing to keep.
  }
}
