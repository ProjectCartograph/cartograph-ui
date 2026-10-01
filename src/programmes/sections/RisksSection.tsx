import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/copy";
import { useSectionAutosave, useDefinitionStore } from "@/definition/store";
import { RiskList } from "@/projects/RiskList";
import { RiskMatrix } from "@/projects/RiskMatrix";
import type { Risk } from "@/projects/types";
import type { ProgrammeSpec } from "../types";

const rc = copy.projects.risks;

/**
 * What could stop the programme, and what it waits on.
 *
 * The same list a project keeps, minus the phase a dependency lands by: a
 * programme schedules nothing, so how it is staged is the delivery tool's.
 * The dependencies here are the ones worth drawing a tree from — the
 * Strategic Plan states linkages between its programmes twenty-six times.
 *
 * The grid came with it on 2026-09-29: it was the project step's and not
 * this one's, and a programme's risks are the ones read across a
 * portfolio of them, which is exactly the reading a grid is for
 * (Programme Lead, 2026-09-28).
 */
export function RisksSection() {
  useSectionAutosave();
  const store = useDefinitionStore<ProgrammeSpec>();
  const risks = store.spec.risks ?? [];
  const [gridPick, setGridPick] = useState<number | null>(null);

  function updateRisks(next: Risk[]) {
    store.updateSpec((s) => ({ ...s, risks: next.length > 0 ? next : undefined }));
  }

  /** Placing a risk on the grid writes impact and likelihood onto that
   * one row; every other edit goes through the shared list. */
  function place(idx: number, patch: Partial<Risk>) {
    updateRisks(risks.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <RiskMatrix
          risks={risks}
          selected={gridPick}
          onPlace={(impact, likelihood) => {
            if (gridPick === null) return;
            place(gridPick, { impact, likelihood });
          }}
        />
        {risks.length > 0 ? (
          <Select
            value={gridPick === null ? "" : String(gridPick)}
            onValueChange={(v) => setGridPick(Number(v))}
          >
            <SelectTrigger className="w-72" aria-label={rc.placePrompt}>
              <SelectValue placeholder={rc.placePrompt} />
            </SelectTrigger>
            <SelectContent>
              {risks.map((r, idx) => (
                <SelectItem key={r.id ?? idx} value={String(idx)}>
                  {r.description || `#${idx + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <RiskList risks={risks} phases={[]} onChange={updateRisks} />
    </div>
  );
}
