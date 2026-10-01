import { useQuery } from "@tanstack/react-query";

import { FieldHeading } from "@/components/guidance";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { useGoalTree } from "@/surfaces/goals/api";
import type { GoalNode } from "@/surfaces/goals/tree-types";
import { Input } from "@/components/ui/input";
import { client } from "@/api/client";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { PartText } from "@/projects/StatementEditor";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import type { GapSpec } from "../types";

const gc = copy.gaps;

/**
 * The gap itself, as gap analysis states one: a short name, where things
 * are now and where they should be (Kaufman: a need is the gap between
 * current and desired results). Three short answers, not one long
 * sentence, which is what people found too verbose (2026-09-30).
 *
 * A KPI can carry both states: its baseline is where things are and its
 * target where they should be, shown here rather than typed twice.
 */
export function ShortfallSection() {
  useSectionAutosave();
  const store = useDefinitionStore<GapSpec>();
  const spec = store.spec;
  const kpi = useKPIStates(spec.measure);
  const outcomeOptions = useOutcomeOptions();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.nameLabel} hint={gc.nameHint} htmlFor="gap-name" />
        <Input
          id="gap-name"
          value={store.name}
          maxLength={80}
          onChange={(e) => store.setName(e.target.value.slice(0, 80))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.measureLabel} hint={gc.measureHint} />
        <ReferencePicker
          refKind="KPI"
          value={spec.measure}
          onChange={(v) => store.updateSpec((s) => ({ ...s, measure: v || undefined }))}
          placeholder={gc.measurePlaceholder}
          label={gc.measureLabel}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <FieldHeading label={gc.currentLabel} hint={gc.currentHint} examples={gc.currentExamples} exampleKey="gap.current" />
          {kpi?.baseline ? <p className="text-sm text-muted-foreground" data-slot="kpi-baseline">{gc.fromKpi(kpi.baseline)}</p> : null}
          <PartText
            value={spec.current}
            label={gc.currentLabel}
            onChange={(v) => store.updateSpec((s) => ({ ...s, current: v.slice(0, 200) || undefined }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldHeading label={gc.desiredLabel} hint={gc.desiredHint} examples={gc.desiredExamples} exampleKey="gap.desired" />
          {kpi?.target ? <p className="text-sm text-muted-foreground" data-slot="kpi-target">{gc.fromKpi(kpi.target)}</p> : null}
          <PartText
            value={spec.desired}
            label={gc.desiredLabel}
            onChange={(v) => store.updateSpec((s) => ({ ...s, desired: v.slice(0, 200) || undefined }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.outcomesLabel} hint={gc.outcomesHint} />
        {outcomeOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{gc.outcomesNone}</p>
        ) : (
          <ComboboxMultiple
            options={outcomeOptions}
            value={spec.outcomes ?? []}
            onValueChange={(next) => store.updateSpec((s) => ({ ...s, outcomes: next.length > 0 ? next : undefined }))}
            placeholder={gc.outcomesPlaceholder}
            emptyText={copy.sheets.dialog.noMatches}
            removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
            aria-label={gc.outcomesLabel}
          />
        )}
      </div>
    </div>
  );
}

/** Every outcome goal, the level a gap closes into (D24). */
function useOutcomeOptions() {
  const { data } = useGoalTree();
  const out: { value: string; label: string }[] = [];
  const walk = (ns: GoalNode[]) =>
    ns.forEach((n) => {
      if (n.level === "outcome") out.push({ value: n.id, label: n.name });
      walk(n.children ?? []);
    });
  walk(data?.nodes ?? []);
  return out;
}

/** A KPI's baseline and target, as short readings like "62, March 2025". */
function useKPIStates(id: string | undefined) {
  const { data } = useQuery({
    queryKey: ["kpi-states", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await client.GET("/manifests/{kind}/{id}", { params: { path: { kind: "KPI", id: id! } } });
      if (res.error || !res.data) return null;
      const spec = (res.data as unknown as { manifest?: { spec?: Record<string, unknown> } }).manifest?.spec ?? {};
      const read = (v: unknown) => {
        const p = v as { value?: number | string; date?: string } | undefined;
        if (p?.value === undefined || p.value === "") return "";
        return [String(p.value), p.date].filter(Boolean).join(", ");
      };
      return { baseline: read(spec.baseline), target: read(spec.target) };
    },
  });
  return id ? data : undefined;
}
