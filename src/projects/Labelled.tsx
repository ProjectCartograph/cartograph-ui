import type { ReactNode } from "react";

/** A field with its name above it, so a control with nothing typed in it
 * still says what it is (no words inside controls), and what goes in it
 * beneath, where there is more to say than its name. */
export function Labelled({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-xs text-muted-foreground ${className ?? ""}`}>
      <span>{label}</span>
      {children}
      {hint ? <span className="text-pretty">{hint}</span> : null}
    </label>
  );
}
