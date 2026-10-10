import { ArrowDownToLine, Lock, SlidersHorizontal, TriangleAlert } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copy } from "@/copy";
import { useProjectStore } from "../store";
import { CONSTRAINTS, STANCES, type Stance } from "../types";

const tc = copy.projects.triangle;
const ICON = { hold: Lock, adjust: SlidersHorizontal, concede: ArrowDownToLine } as const;

/**
 * How the project holds scope, schedule and cost when something has to
 * give, set up front (the project flexibility matrix, engine TAXONOMY.md
 * D60): each side's three stances as icon tiles, never a yes or no.
 */
export function ConstraintStances() {
  const store = useProjectStore();
  const stances = store.spec.constraints ?? {};
  const allHeld = CONSTRAINTS.every((c) => stances[c] === "hold");
  return (
    <section className="flex flex-col gap-3" data-cartograph-region="constraint-stances">
      <div>
        <h3 className="text-sm font-medium">{tc.stancesHeading}</h3>
        <p className="text-sm text-muted-foreground text-pretty">{tc.stancesLead}</p>
      </div>
      <div className="flex flex-col gap-2">
        {CONSTRAINTS.map((side) => (
          <div key={side} className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-sm" title={tc.sideHint[side]}>
              {tc.sides[side]}
            </span>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={stances[side] ?? ""}
              data-cartograph-field={`/spec/constraints/${side}`}
              aria-label={tc.stanceFor(tc.sides[side])}
              onValueChange={(v) =>
                store.updateSpec((s) => {
                  const next = { ...(s.constraints ?? {}) };
                  if (v) next[side] = v as Stance;
                  else delete next[side];
                  return { ...s, constraints: next };
                })
              }
            >
              {STANCES.map((st) => {
                const Icon = ICON[st];
                return (
                  <ToggleGroupItem key={st} value={st} aria-label={tc.stanceTitle[st]} title={tc.stanceTitle[st]}>
                    <Icon />
                    {tc.stances[st]}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        ))}
      </div>
      {allHeld ? (
        <p className="flex items-center gap-1.5 text-sm text-warning" role="status">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {tc.allHeld}
        </p>
      ) : null}
    </section>
  );
}
