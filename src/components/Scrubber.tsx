import type { ComponentType, CSSProperties } from "react";

import { copy } from "@/copy";

type Icon = ComponentType<{ className?: string }>;
type State = "ok" | "warn" | "block";

export interface ScrubStep {
  key: string;
  label: string;
  /** The worst check on it; left out when nothing is checked yet. */
  state?: State;
  /** Others on this step, as a ring (collab/SectionPeers). */
  ring?: CSSProperties;
}

export interface ScrubStage {
  key: string;
  label: string;
  icon?: Icon;
  steps: ScrubStep[];
}

const TONE: Record<State | "none", string> = {
  ok: "bg-success",
  warn: "bg-warning/50",
  block: "bg-warning",
  none: "bg-muted-foreground/25",
};

/**
 * The one way through a flow, as a timeline scrubber: every stage a
 * segment, every step in it a mark coloured by how it stands, the step in
 * hand raised. Any mark goes to its step. It replaces a stepper, a rail
 * and an outline with a single control that shows the whole walk.
 */
export function Scrubber({
  stages,
  stage,
  step,
  onGo,
  label,
}: {
  stages: ScrubStage[];
  /** The stage and step in hand, by key. */
  stage: string;
  step: string;
  onGo: (stage: string, step: string) => void;
  label: string;
}) {
  const c = copy.flow;
  const here = stages.find((s) => s.key === stage);
  const hereStep = here?.steps.find((s) => s.key === step);
  return (
    <nav aria-label={label} data-slot="scrubber" className="flex flex-col gap-2">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max gap-3 sm:min-w-0">
          {stages.map((s) => {
            const Icon = s.icon;
            const current = s.key === stage;
            return (
              <li key={s.key} className="flex min-w-0 flex-col gap-1.5" style={{ flex: `${s.steps.length} 1 0%`, minWidth: `${s.steps.length * 1.5}rem` }}>
                <span className={`flex min-w-0 items-center gap-1 text-xs ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                  <span className={`truncate ${current ? "" : "hidden sm:inline"}`}>{s.label}</span>
                </span>
                <span className="flex items-center gap-0.5">
                  {s.steps.map((p) => {
                    const at = current && p.key === step;
                    const said = p.state === "ok" ? c.done : p.state === "block" ? c.blocked : p.state === "warn" ? c.warn : c.notYet;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => onGo(s.key, p.key)}
                        aria-current={at ? "step" : undefined}
                        aria-label={`${s.label}: ${p.label}, ${said}`}
                        title={`${p.label}: ${said}`}
                        data-scrub-step={p.key}
                        data-state={p.state ?? "none"}
                        style={p.ring}
                        className="group flex h-6 min-w-0 flex-1 items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={`w-full rounded-full transition-all duration-150 ease-standard ${TONE[p.state ?? "none"]} ${
                            at ? "h-3 ring-2 ring-foreground ring-offset-2 ring-offset-background" : "h-1.5 group-hover:h-2.5"
                          }`}
                        />
                      </button>
                    );
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {here && hereStep ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{here.label}</span> · {hereStep.label}
        </p>
      ) : null}
    </nav>
  );
}
