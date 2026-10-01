import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

import type { FieldConflict } from "@/client/port";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { byAttr, onScreen, useRelayout } from "./relayout";

const cc = copy.collab;

/** What a field is called on screen: its own label, read from the page. */
function labelOf(path: string): string {
  const el = byAttr("data-cartograph-field", path);
  if (!el) return cc.thisField;
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const labelledBy = el.getAttribute("aria-labelledby");
  const named = labelledBy ? document.getElementById(labelledBy.split(" ")[0])?.textContent?.trim() : undefined;
  if (named) return named;
  const control = el.matches("input, textarea, select, button") ? el : el.querySelector("input, textarea, select, button");
  const own = (control as HTMLInputElement | null)?.labels?.[0]?.textContent?.trim();
  return own || cc.thisField;
}

function shown(value: unknown): string {
  if (value === undefined || value === null || value === "") return cc.blankValue;
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** A mark on each field in conflict, drawn over it and taking no input. */
function ConflictMarks({ conflicts }: { conflicts: FieldConflict[] }) {
  useRelayout(conflicts.length > 0);
  if (conflicts.length === 0 || typeof document === "undefined") return null;
  return createPortal(
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 55 }}>
      {conflicts.map((c) => {
        const el = byAttr("data-cartograph-field", c.path);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!onScreen(r)) return null;
        return (
          <div
            key={c.path}
            data-slot="conflict-mark"
            data-field={c.path}
            className="absolute rounded-md outline-2 outline-dashed outline-amber-500"
            style={{ left: r.left - 3, top: r.top - 3, width: r.width + 6, height: r.height + 6 }}
          >
            <AlertTriangle className="absolute -right-2 -top-2 size-4 rounded-full bg-background text-amber-600" />
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

/**
 * The fields two people set at once, as notes in the shape the check panel
 * has: the value showing, every other value set beside it, and a way to
 * keep either. Nothing is lost until somebody chooses. Shown only while
 * there is a conflict.
 */
export function ConflictNotes({
  conflicts,
  onResolve,
  within,
}: {
  conflicts: FieldConflict[];
  onResolve: (path: string, value: unknown) => void;
  /** Only the fields under this pointer (the step on screen). */
  within?: (path: string) => boolean;
}) {
  const scoped = within ? conflicts.filter((c) => within(c.path)) : conflicts;
  if (scoped.length === 0) return null;
  return (
    <>
      <ConflictMarks conflicts={scoped} />
      <section
        data-slot="conflict-notes"
        data-cartograph-region="conflicts"
        aria-label={cc.conflictsTitle}
        className="flex flex-col gap-3 rounded-lg border border-amber-500/50 p-4"
      >
        <h2 className="text-sm font-semibold">{cc.conflictsTitle}</h2>
        <ul className="flex flex-col gap-3">
          {scoped.map((c) => (
            <li key={c.path} data-conflict={c.path} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span>{cc.conflict(labelOf(c.path))}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{cc.conflictKept}</span>
                  <span className="min-w-0 truncate font-medium">{shown(c.value)}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onResolve(c.path, c.value)}>
                    {cc.conflictKeep}
                  </Button>
                </div>
                {c.others.map((other, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">{cc.conflictOther}</span>
                    <span className="min-w-0 truncate font-medium">{shown(other)}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => onResolve(c.path, other)}>
                      {cc.conflictRestore}
                    </Button>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
