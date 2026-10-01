import { useEffect, useLayoutEffect, useRef } from "react";

import type { PresenceCaret, SharedDraft } from "@/client/port";
import { usePresence } from "./presenceContext";

const FIELD = "[data-cartograph-field]";
const TARGET = "[data-cartograph-field], [data-cartograph-region]";

function fieldPath(el: EventTarget | Element | null): string | undefined {
  return el instanceof Element ? (el.closest(FIELD)?.getAttribute("data-cartograph-field") ?? undefined) : undefined;
}

function textControl(el: unknown): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ["text", "search", "url", "email", ""].includes(el.type));
}

/** The selection in a text field as Automerge cursors, so it stays on the
 * same characters while others type; null where the field is not text. */
function caretOf(draft: SharedDraft | undefined, el: Element | null, path: string): PresenceCaret | null {
  // Only a control that is the field's own text has a caret in it.
  if (!draft || !textControl(el) || el.getAttribute("data-cartograph-field") !== path) return null;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (start === null || end === null) return null;
  const backward = el.selectionDirection === "backward";
  const anchor = draft.cursor(path, backward ? end : start);
  const head = draft.cursor(path, backward ? start : end);
  return anchor && head ? { path, anchor, head } : null;
}

/**
 * Says what this session is doing, as it does it: the field in focus, the
 * selection inside it and the pointer, relative to the field or region it
 * is over. Draws nothing and never stands in the way of input: it only
 * listens.
 */
export function PresenceTracker() {
  const presence = usePresence();
  const api = useRef(presence);
  useLayoutEffect(() => {
    api.current = presence;
  });

  useEffect(() => {
    let lastCaret = "";
    const publishCaret = () => {
      const el = document.activeElement;
      const path = fieldPath(el);
      if (!path) return;
      const caret = caretOf(api.current.draft, el, path);
      const key = JSON.stringify(caret);
      if (key === lastCaret) return;
      lastCaret = key;
      api.current.publish({ caret });
    };
    const onFocus = (e: FocusEvent) => {
      const path = fieldPath(e.target);
      if (!path) return;
      const caret = caretOf(api.current.draft, e.target as Element, path);
      lastCaret = JSON.stringify(caret);
      api.current.publish({ focus: { path }, caret });
    };
    const onBlur = (e: FocusEvent) => {
      if (!fieldPath(e.target) || fieldPath(e.relatedTarget)) return;
      lastCaret = "null";
      api.current.publish({ focus: null, caret: null });
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target.closest(TARGET) : null;
      if (!target) {
        api.current.publish({ pointer: null });
        return;
      }
      const key = target.getAttribute("data-cartograph-field") ?? target.getAttribute("data-cartograph-region") ?? "";
      const r = target.getBoundingClientRect();
      const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
      api.current.publish({
        pointer: {
          target: key,
          x: clamp(r.width > 0 ? (e.clientX - r.left) / r.width : 0),
          y: clamp(r.height > 0 ? (e.clientY - r.top) / r.height : 0),
        },
      });
    };
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) api.current.publish({ pointer: null });
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("selectionchange", publishCaret);
    document.addEventListener("input", publishCaret);
    document.addEventListener("keyup", publishCaret);
    document.addEventListener("mouseup", publishCaret);
    document.addEventListener("pointermove", onPointer);
    document.addEventListener("mouseout", onLeave);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("selectionchange", publishCaret);
      document.removeEventListener("input", publishCaret);
      document.removeEventListener("keyup", publishCaret);
      document.removeEventListener("mouseup", publishCaret);
      document.removeEventListener("pointermove", onPointer);
      document.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return null;
}
