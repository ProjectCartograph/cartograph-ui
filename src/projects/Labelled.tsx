import type { ReactNode } from "react";

/** A field with its name above it, so a control with nothing typed in it
 * still says what it is (no words inside controls). */
export function Labelled({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-xs text-muted-foreground ${className ?? ""}`} title={hint}>
      <span>{label}</span>
      {children}
    </label>
  );
}
