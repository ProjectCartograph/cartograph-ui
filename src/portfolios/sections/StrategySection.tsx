import { useMemo } from "react";

import { ChipPicker, type ChipItem } from "@/components/ChipPicker";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { useGoalTree } from "@/surfaces/goals/api";
import type { PortfolioSpec } from "../types";

const fc = copy.portfolios;

/** The strategic objectives the portfolio is prioritised against: goals
 * and objectives, never outcomes, which are what is then true. */
export function StrategySection() {
  useSectionAutosave();
  const store = useDefinitionStore<PortfolioSpec>();
  const tree = useGoalTree();
  const chips = useMemo<ChipItem[]>(() => {
    const out: ChipItem[] = [];
    for (const goal of tree.data?.nodes ?? []) {
      out.push({ id: goal.id, label: goal.name, group: goal.name });
      for (const objective of goal.children ?? []) {
        if (objective.level === "objective") out.push({ id: objective.id, label: objective.name, group: goal.name, tag: goal.name });
      }
    }
    return out;
  }, [tree.data]);
  const selected = store.spec.objectives ?? [];
  return (
    <div className="flex max-w-3xl flex-col gap-2" data-cartograph-region="portfolio-strategy">
      <FieldHeading label={fc.objectivesLabel} />
      <ChipPicker
        items={chips}
        selected={selected}
        onToggle={(id) =>
          store.updateSpec((s) => {
            const next = selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id];
            return { ...s, objectives: next.length > 0 ? next : undefined };
          })
        }
        placeholder={copy.projects.goals.searchPlaceholder}
        empty={fc.objectivesEmpty}
        slot="portfolio-objective-chips"
        data-cartograph-field="/spec/objectives"
      />
    </div>
  );
}
