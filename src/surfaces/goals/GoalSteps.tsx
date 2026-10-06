import { Save, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Scrubber } from "@/components/Scrubber";
import { FlowBack, FlowNav, FlowNext } from "@/components/walker";
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
 * best answered, as every flow shows its progress (components/walker): a
 * segment each, full once it has what it needs; any can be opened at any
 * time.
 */
export function GoalSteps({ steps, current, onPick }: { steps: GoalStep[]; current: string; onPick: (k: string) => void }) {
  const at = steps.findIndex((s) => s.key === current);
  return (
    <div data-cartograph-region="goal-steps">
      <Scrubber
        stages={steps.map((s) => ({ key: s.key, label: s.label, icon: s.icon, steps: [{ key: s.key, label: s.label, state: s.done ? "ok" : undefined }] }))}
        stage={steps[at]?.key ?? current}
        step={steps[at]?.key ?? current}
        onGo={(_, key) => onPick(key)}
        label={sc.title}
      />
    </div>
  );
}

/** Back and Next, naming where Next goes, as every flow has them. */
export function StepNav({ steps, current, onPick }: { steps: GoalStep[]; current: string; onPick: (k: string) => void }) {
  const i = steps.findIndex((s) => s.key === current);
  const prev = steps[i - 1];
  const next = steps[i + 1];
  return (
    <FlowNav>
      <FlowBack label={sc.back} onClick={() => prev && onPick(prev.key)} hidden={!prev} />
      {next ? <FlowNext label={sc.next(next.label)} icon={next.icon} onClick={() => onPick(next.key)} /> : null}
    </FlowNav>
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
    <div className="flex flex-col gap-4" data-cartograph-region="goal-review">
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
      <Button type="button" className="self-start" onClick={onSave} aria-label={copy.goals.editor.save.buttonLabel} title={copy.goals.editor.save.buttonLabel}>
        <Save />
        {copy.goals.editor.save.button}
      </Button>
    </div>
  );
}
