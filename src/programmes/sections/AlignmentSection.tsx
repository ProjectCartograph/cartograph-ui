import { useMemo, useState } from "react";

import { ChipPicker, type ChipItem } from "@/components/ChipPicker";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { KPIAddDialog } from "@/kpis/KPIAddDialog";
import { labelKeys, mostCommonLabelKey } from "@/labels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGoalTree } from "@/surfaces/goals/api";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import type { ProgrammeSpec } from "../types";

const pc = copy.programmes;

/**
 * What the programme serves: the goals it is accountable for and the
 * standing measures it targets.
 *
 * What is *inside* it is the next step, not this one. A thirty-eight goal
 * tree on the same screen pushed the members below the fold, and they are
 * the half a person opens a programme to read.
 */
export function AlignmentSection() {
  useSectionAutosave();
  const store = useDefinitionStore<ProgrammeSpec>();
  const treeQuery = useGoalTree();
  const { data: kpis } = useReferenceOptions("KPI");

  const goals = store.spec.goals ?? [];

  // Twenty-four measures read as chips; a hundred read as a wall. The
  // tags somebody has actually been using are what turns the wall back
  // into sections, so the grouping starts on the commonest key rather
  // than asking first.
  const kpiLabels = useMemo(() => [...(kpis?.labels?.values() ?? [])], [kpis]);
  const keys = useMemo(() => labelKeys(kpiLabels), [kpiLabels]);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const activeKey = groupKey ?? mostCommonLabelKey(kpiLabels) ?? null;
  const [addKpi, setAddKpi] = useState(false);

  const kpiChips = useMemo<ChipItem[]>(
    () =>
      (kpis?.options ?? []).map((o) => ({
        id: o.value,
        label: o.label,
        // Every chip carries a heading or none of them do, so a measure
        // with no tag of this key sits under its own.
        group: activeKey
          ? (kpis?.labels?.get(o.value)?.[activeKey] ?? copy.labels.untagged)
          : undefined,
      })),
    [kpis, activeKey],
  );

  const chips = useMemo<ChipItem[]>(() => {
    const out: ChipItem[] = [];
    for (const pillar of treeQuery.data?.nodes ?? []) {
      for (const strategic of pillar.children ?? []) {
        for (const functional of strategic.children ?? []) {
          if (functional.level !== "outcome") continue;
          out.push({
            id: functional.id,
            label: functional.name,
            group: pillar.name,
            tag: strategic.name,
            title: `${pillar.name} / ${strategic.name}`,
          });
        }
      }
    }
    return out;
  }, [treeQuery.data]);

  function toggleGoal(id: string) {
    store.updateSpec((s) => {
      const next = (s.goals ?? []).includes(id)
        ? (s.goals ?? []).filter((g) => g !== id)
        : [...(s.goals ?? []), id];
      return { ...s, goals: next.length > 0 ? next : undefined };
    });
  }


  return (
    <div className="flex max-w-3xl flex-col gap-8" data-cartograph-region="programme-alignment">
      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.goalsLabel} />
        <ChipPicker
          items={chips}
          selected={goals}
          onToggle={toggleGoal}
          placeholder={copy.projects.goals.searchPlaceholder}
          empty={pc.goalsEmpty}
          slot="programme-goal-chips"
          data-cartograph-field="/spec/goals"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-2">
          <FieldHeading label={pc.kpisLabel} />
          {keys.length > 0 ? (
            <Select
              value={activeKey ?? ""}
              onValueChange={(v) => setGroupKey(v === "" ? null : v)}
            >
              <SelectTrigger size="sm" className="w-44" aria-label={copy.labels.groupBy}>
                <SelectValue placeholder={copy.labels.groupBy} />
              </SelectTrigger>
              <SelectContent>
                {keys.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <ChipPicker
          items={kpiChips}
          addLabel={copy.kpis.addTitle}
          onAdd={() => setAddKpi(true)}
          selected={store.spec.kpis ?? []}
          onToggle={(id) =>
            store.updateSpec((s) => {
              const next = (s.kpis ?? []).includes(id)
                ? (s.kpis ?? []).filter((k) => k !== id)
                : [...(s.kpis ?? []), id];
              return { ...s, kpis: next.length > 0 ? next : undefined };
            })
          }
          placeholder={pc.kpisSearchPlaceholder}
          empty={pc.kpisEmpty}
          slot="programme-kpi-chips"
          data-cartograph-field="/spec/kpis"
        />
        <KPIAddDialog
          open={addKpi}
          onOpenChange={setAddKpi}
          onAdded={(id) =>
            store.updateSpec((sp) => ({ ...sp, kpis: [...(sp.kpis ?? []), id] }))
          }
        />
      </div>
    </div>
  );
}
