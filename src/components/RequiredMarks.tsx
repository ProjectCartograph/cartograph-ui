import { useEffect, useMemo } from "react";

import { copy } from "@/copy";
import { useGuide } from "./guide";
import { pointerMatches } from "./pointer";

/**
 * Marks what a definition cannot leave out, the same way in every flow:
 * every control whose field the engine's guide marks required (the
 * schema requires it, or a handoff waits on it) carries data-required,
 * which draws its bar, and aria-required for a screen reader. Controls are
 * found by the pointer every one already carries, so no screen has to
 * remember which of its fields are required, and one the engine starts to
 * require is marked without a change here.
 */
export function RequiredMarks({ kind, level }: { kind: string; level?: string }) {
  const { data: guide } = useGuide(kind, level);
  const paths = useMemo(
    () => (guide?.steps ?? []).flatMap((st) => st.fields.filter((f) => f.required).map((f) => f.path)),
    [guide],
  );
  useEffect(() => {
    if (paths.length === 0) return;
    const mark = () => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-cartograph-field]"))) {
        const pointer = el.getAttribute("data-cartograph-field") ?? "";
        const required = paths.some((p) => pointerMatches(pointer, p));
        if (required && !el.hasAttribute("data-required")) {
          el.setAttribute("data-required", "");
          el.setAttribute("aria-required", "true");
        }
      }
    };
    mark();
    // Steps and list items come and go: marked as they appear.
    const watch = new MutationObserver(mark);
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [paths]);
  return paths.length > 0 ? (
    <p className="flex items-center gap-2 text-xs text-muted-foreground" data-slot="required-legend">
      <span className="h-3.5 w-[3px] rounded-full bg-warning" aria-hidden="true" />
      {copy.required.legend}
    </p>
  ) : null;
}
