import { ArrowLeft, ArrowRight, Check, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ProgressRing";
import { useManifestName } from "@/api/names";
import { copy } from "@/copy";
import { SmartMarks } from "./SmartMarks";
import type { GoalNode } from "./tree-types";

const sc = copy.goals.editor.steps;

export interface GoalStep {
  key: string;
  label: string;
  icon: LucideIcon;
  done: boolean;
  optional?: boolean;
}

/**
 * The steps of defining an aim, one question each, in the order they are
 * best answered. Each lights when it has what it needs; any can be opened
 * at any time. Same shape as the project and gap flows (D22).
 */
export function GoalSteps({ steps, current, onPick }: { steps: GoalStep[]; current: string; onPick: (k: string) => void }) {
  const counted = steps.filter((s) => !s.optional && s.key !== "review");
  const done = counted.filter((s) => s.done).length;
  return (
    <nav aria-label={sc.title} className="flex flex-col gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ProgressRing value={counted.length ? done / counted.length : 0} size={16} label={sc.progress(done, counted.length)} className="text-primary" />
        <span className="font-medium">{sc.title}</span>
      </div>
      <ol className="flex flex-wrap gap-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const active = s.key === current;
          return (
            <li key={s.key}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onPick(s.key)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm ${active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:bg-background/60"}`}
              >
                <span className={`flex size-5 items-center justify-center rounded-full text-[11px] ${s.done ? "bg-foreground text-background" : "border border-dashed border-muted-foreground/60"}`} aria-hidden="true">
                  {s.done ? <Check className="size-3" /> : i + 1}
                </span>
                <Icon className="size-3.5" aria-hidden="true" />
                {s.label}
                {s.done ? <span className="sr-only">{sc.doneWord}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Back and Next, naming where Next goes. */
export function StepNav({ steps, current, onPick }: { steps: GoalStep[]; current: string; onPick: (k: string) => void }) {
  const i = steps.findIndex((s) => s.key === current);
  const prev = steps[i - 1];
  const next = steps[i + 1];
  return (
    <div className="flex justify-between gap-2 border-t pt-4">
      {prev ? (
        <Button type="button" variant="outline" onClick={() => onPick(prev.key)}>
          <ArrowLeft />
          {sc.back}
        </Button>
      ) : <span />}
      {next ? (
        <Button type="button" onClick={() => onPick(next.key)}>
          {sc.next(next.label)}
          <ArrowRight />
        </Button>
      ) : null}
    </div>
  );
}

/** Everything the steps gathered, on one page, before saving. */
export function GoalReview({
  levelLabel,
  objective,
  keyResults,
  indicators,
  horizon,
  ownerId,
  why,
  smart,
  onEdit,
  onSave,
}: {
  level: string;
  levelLabel: string;
  objective: string;
  keyResults: number;
  indicators: number;
  horizon: string;
  ownerId?: string;
  why: string;
  smart?: GoalNode["smart"];
  onEdit: (step: string) => void;
  onSave: () => void;
}) {
  const owner = useManifestName("Resource", ownerId).data ?? ownerId;
  const rows: { step: string; label: string; value: string }[] = [
    { step: "aim", label: levelLabel, value: objective },
    { step: "measures", label: sc.measures, value: keyResults + indicators > 0 ? sc.measureCount(keyResults, indicators) : "" },
    { step: "timing", label: copy.goals.editor.horizon.label, value: horizon },
    { step: "timing", label: copy.goals.editor.owner.label, value: owner ?? "" },
    { step: "why", label: copy.goals.editor.whyItMatters.label, value: why },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <SmartMarks smart={smart} />
        <span className="text-xs text-muted-foreground">{sc.smartNote}</span>
      </div>
      <dl className="flex flex-col divide-y rounded-lg border">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[9rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className={r.value ? "" : "text-muted-foreground italic"}>{r.value || sc.notYet}</dd>
            <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => onEdit(r.step)}>
              {sc.edit}
            </Button>
          </div>
        ))}
      </dl>
      <Button type="button" className="self-start" onClick={onSave}>{copy.goals.editor.save.button}</Button>
    </div>
  );
}
