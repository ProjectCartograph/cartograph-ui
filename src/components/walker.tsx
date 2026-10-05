import type { ReactNode } from "react";

/**
 * The pieces of a walker: one question to a screen, the steps along the
 * top, each step sliding in from the side it was reached from. Starting
 * a project and opening a new workspace walk alike.
 */

/** Where the person is: every step, the one in hand marked, those passed
 * open to return to. */
export function WalkerProgress({ labels, at, onGo, label }: { labels: string[]; at: number; onGo: (i: number) => void; label: string }) {
  return (
    <ol className="flex items-center gap-2" aria-label={label}>
      {labels.map((s, i) => (
        <li key={`${s}-${i}`} className="flex flex-1 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onGo(i)}
            aria-current={i === at ? "step" : undefined}
            className="flex flex-col gap-1.5 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="relative h-1 overflow-hidden rounded-full bg-muted">
              {/* Filled by scaling, never by width (rule 11). */}
              <span
                className={`absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-300 ease-standard motion-reduce:transition-none ${i <= at ? "scale-x-100" : "scale-x-0"}`}
              />
            </span>
            <span className={`truncate text-xs ${i === at ? "font-medium text-foreground" : "text-muted-foreground"}`}>{s}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** One step, entering from the side it was reached from. */
export function WalkerStep({ step, forward, children }: { step: string; forward: boolean; children: ReactNode }) {
  return (
    <div key={step} className={`flex flex-col gap-6 animate-in fade-in duration-300 ease-enter ${forward ? "slide-in-from-right-6" : "slide-in-from-left-6"}`} data-step={step}>
      {children}
    </div>
  );
}

export function WalkerQuestion({ title, hint, lead, children }: { title: string; hint?: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        {lead ? <div className="text-sm font-medium text-primary/80 text-pretty">{lead}</div> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        {hint ? <p className="text-muted-foreground text-pretty">{hint}</p> : null}
      </div>
      {children}
    </>
  );
}
