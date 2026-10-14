import type { ComponentType, ReactElement, ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, OctagonAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";

/**
 * The pieces of a walker: one question to a screen, the steps along the
 * top, each step sliding in from the side it was reached from. Starting
 * a project and opening a new workspace walk alike.
 */

/** A mark beside a label: any icon that takes a class. */
type Icon = ComponentType<{ className?: string }>;

/** One segment of a flow's progress: a step or a stage. */
export interface FlowSegment {
  key: string;
  label: string;
  icon?: Icon;
  /** How complete it is, 0 to 1, where the flow knows (a definition's
   * checks); left out, a segment is full once it is reached (a walker). */
  share?: number;
  /** The worst check standing on it, marked beside its label. */
  state?: "ok" | "warn" | "block";
  /** Its own words for a screen reader, where the bar says more than the
   * label (how much of a stage is clear). */
  title?: string;
}

/**
 * Where the person is in any flow: a segment per step or stage, the one
 * in hand marked, each open to go to. One bar for every flow, so starting
 * a project, opening a workspace and defining any record read alike: the
 * walker's segments, carrying what the project walk showed (how much of
 * each is done, and what is wrong in it).
 */
export function FlowProgress({
  segments,
  at,
  onGo,
  label,
  canGo = () => true,
}: {
  segments: FlowSegment[];
  at: number;
  onGo: (i: number) => void;
  label: string;
  /** Whether a segment may be gone to now; one that may not is shown,
   * but does nothing. */
  canGo?: (i: number) => boolean;
}) {
  const c = copy.flow;
  return (
    <ol className="flex items-start gap-2" aria-label={label} data-slot="flow-progress">
      {segments.map((s, i) => {
        const Icon = s.icon;
        const share = s.share ?? (i <= at ? 1 : 0);
        const here = i === at;
        return (
          <li key={s.key} className="flex min-w-0 flex-1 flex-col">
            <button
              type="button"
              onClick={() => canGo(i) && onGo(i)}
              aria-current={here ? "step" : undefined}
              aria-disabled={!canGo(i) || undefined}
              title={s.title}
              data-flow-state={s.state}
              className="flex min-w-0 flex-col gap-1.5 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default"
            >
              <span className={`relative h-1 overflow-hidden rounded-full ${here ? "bg-primary/20" : "bg-muted"}`}>
                {/* Filled by scaling, never by width (rule 11). */}
                <span
                  className="absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-300 ease-standard motion-reduce:transition-none"
                  style={{ transform: `scaleX(${Math.min(Math.max(share, 0), 1)})` }}
                />
              </span>
              <span className={`flex min-w-0 items-center gap-1 text-xs ${here ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {Icon ? (
                  <span aria-hidden="true" className="contents">
                    <Icon className={`size-3.5 shrink-0 ${here ? "text-primary" : ""}`} />
                  </span>
                ) : null}
                <span className="truncate">{s.label}</span>
                {s.state === "block" ? (
                  <OctagonAlert className="size-3 shrink-0 text-destructive" aria-label={c.blocked} />
                ) : s.state === "warn" ? (
                  <AlertTriangle className="size-3 shrink-0 text-warning" aria-label={c.warn} />
                ) : s.state === "ok" ? (
                  <CheckCircle2 className="size-3 shrink-0 text-success/70" aria-label={c.done} />
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Where the person is in a walker: every step, the one in hand marked,
 * those passed open to return to. A FlowProgress whose segments fill as
 * they are reached. */
export function WalkerProgress({ labels, at, onGo, label }: { labels: string[]; at: number; onGo: (i: number) => void; label: string }) {
  return <FlowProgress segments={labels.map((l, i) => ({ key: `${l}-${i}`, label: l }))} at={at} onGo={onGo} label={label} />;
}

/** The bar under every flow's step: Back on the left, the way forward on
 * the right, each the same size and weight in every flow. */
export function FlowNav({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex items-center justify-between gap-2 pt-6" data-slot="flow-nav">
      {children}
    </div>
  );
}

/** A link a flow button renders through: the router's Link, typed where it
 * is written, wrapped around what the button shows. */
type AsLink = (children: ReactNode) => ReactElement;

/** Back: quiet, with its arrow. */
export function FlowBack({ label, onClick, link, hidden }: { label: string; onClick?: () => void; link?: AsLink; hidden?: boolean }) {
  const body = (
    <>
      <ArrowLeft />
      {label}
    </>
  );
  return (
    <Button type={link ? undefined : "button"} asChild={!!link} variant="ghost" size="lg" onClick={onClick} className={hidden ? "invisible" : undefined}>
      {link ? link(body) : body}
    </Button>
  );
}

/** The way forward: the primary action, naming where it goes. */
export function FlowNext({
  label,
  onClick,
  link,
  icon: Icon,
  disabled,
  arrow = true,
}: {
  label: string;
  onClick?: () => void;
  link?: AsLink;
  icon?: Icon;
  disabled?: boolean;
  arrow?: boolean;
}) {
  const body = (
    <>
      {Icon ? <Icon /> : null}
      {label}
      {arrow ? <ArrowRight /> : null}
    </>
  );
  return (
    <Button type={link ? undefined : "button"} asChild={!!link} size="lg" onClick={onClick} disabled={disabled} data-flow-next="">
      {link ? link(body) : body}
    </Button>
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
