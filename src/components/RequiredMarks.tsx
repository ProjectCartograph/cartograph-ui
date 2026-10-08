import { useEffect, useMemo } from "react";

import { copy } from "@/copy";
import { useGuide } from "./guide";
import { pointerMatches } from "./pointer";

/**
 * Marks what a definition cannot leave out, the same way in every flow:
 * every control whose field the engine's guide marks required (the
 * schema requires it, or a handoff waits on it) carries data-required,
 * a soft border around it, and aria-required for a screen reader. Left
 * empty, it says why it is required under it: the guide's own words for
 * the check that waits on it. Controls are found by the pointer every one
 * already carries, so no screen remembers which of its fields are
 * required, and one the engine starts to require is marked without a
 * change here.
 */
export function RequiredMarks({ kind, level }: { kind: string; level?: string }) {
  const { data: guide } = useGuide(kind, level);
  // Why each is required, said the same way for every field: a field
  // the schema requires stops the merge; one a check needs stops the
  // hand-off (the guide marks both required).
  const reasons = useMemo(() => {
    const out = new Map<string, string>();
    for (const st of guide?.steps ?? []) {
      for (const f of st.fields) {
        if (f.required) out.set(f.path, (f.checks ?? []).length > 0 ? copy.required.handoff : copy.required.because);
      }
    }
    return out;
  }, [guide]);
  useEffect(() => {
    if (reasons.size === 0) return;
    const reasonOf = (el: HTMLElement) => {
      const pointer = el.getAttribute("data-cartograph-field") ?? "";
      return [...reasons].find(([p]) => pointerMatches(pointer, p))?.[1];
    };
    const mark = () => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-cartograph-field]"))) {
        if (!el.hasAttribute("data-required")) {
          if (!reasonOf(el)) continue;
          el.setAttribute("data-required", "");
          el.setAttribute("aria-required", "true");
        }
        showFilled(el);
      }
    };
    // The marked field an event happened in, whether on the control or
    // inside it.
    const fieldOf = (t: EventTarget | null) => (t instanceof HTMLElement ? t.closest<HTMLElement>("[data-required]") : null);
    // Emptied, or left empty: say why it is needed. Filled: clear it.
    const onInput = (e: Event) => {
      const el = fieldOf(e.target);
      const reason = el && reasonOf(el);
      if (el && reason) explain(el, reason, valueOf(el)?.trim() !== "");
      if (el) showFilled(el);
    };
    // A picker or toggle settles after the click that changed it.
    const onPick = (e: Event) => {
      const el = fieldOf(e.target);
      setTimeout(() => (el ? showFilled(el) : mark()), 0);
    };
    const onLeave = (e: Event) => {
      const el = fieldOf(e.target);
      const reason = el && reasonOf(el);
      if (el && reason) explain(el, reason);
    };
    mark();
    // Steps and list items come and go: marked as they appear.
    const watch = new MutationObserver(mark);
    watch.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusout", onLeave, true);
    document.addEventListener("click", onPick, true);
    return () => {
      watch.disconnect();
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusout", onLeave, true);
      document.removeEventListener("click", onPick, true);
    };
  }, [reasons]);
  return null;
}

/**
 * Whether a required control holds something: text in a box, a choice in
 * a picker (a Radix select drops data-placeholder once chosen), a pressed
 * toggle or a checked box. undefined when it cannot be read, and then the
 * mark stays.
 */
function isFilled(el: HTMLElement): boolean | undefined {
  const text = valueOf(el);
  if (text !== undefined) return text.trim() !== "";
  const picker = el.matches('[role="combobox"]') ? el : el.querySelector<HTMLElement>('[role="combobox"]');
  if (picker) return !picker.hasAttribute("data-placeholder");
  if (el.querySelector('[aria-pressed="true"], [data-state="on"], [data-state="checked"], [aria-checked="true"]')) return true;
  if (el.querySelector('[aria-pressed], [data-state], [aria-checked]')) return false;
  return undefined;
}

/** Once a required control is filled it is no longer marked (index.css):
 * the mark is for what is still to do, not for what is done. */
function showFilled(el: HTMLElement) {
  if (isFilled(el)) el.setAttribute("data-required-filled", "");
  else el.removeAttribute("data-required-filled");
}

/** The value a required control holds, as text, or undefined when it is
 * not one whose emptiness can be read. */
function valueOf(el: HTMLElement): string | undefined {
  const control = el.matches("input, textarea, select") ? el : el.querySelector("input, textarea, select");
  return control ? (control as HTMLInputElement).value : undefined;
}

/** Shows or clears why a required control may not be left empty. */
function explain(el: HTMLElement, reason: string, typing = false) {
  const value = valueOf(el);
  const missing = value !== undefined && value.trim() === "";
  const id = `${el.getAttribute("data-cartograph-field")}-required`;
  let note = document.getElementById(id);
  if (!missing) {
    el.removeAttribute("data-required-missing");
    note?.remove();
    return;
  }
  if (typing) return;
  el.setAttribute("data-required-missing", "");
  if (!note) {
    note = document.createElement("p");
    note.id = id;
    note.className = "mt-1 text-xs text-warning";
    note.setAttribute("data-slot", "required-reason");
    el.insertAdjacentElement("afterend", note);
    el.setAttribute("aria-describedby", id);
  }
  note.textContent = reason;
}
