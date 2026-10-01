import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/copy";
import { ContextRecap } from "../ContextRecap";
import { RiskList } from "../RiskList";
import { roleOptions, useResourceNames } from "../RoleRefPicker";
import { RiskMatrix } from "../RiskMatrix";
import { useSectionAutosave, useProjectStore } from "../store";
import type { Risk } from "../types";

const rc = copy.projects.risks;


export function RisksSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const resourceName = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], resourceName);
  const risks = store.spec.risks ?? [];
  const [gridPick, setGridPick] = useState<number | null>(null);

  function updateRisks(next: Risk[]) {
    store.updateSpec((s) => ({ ...s, risks: next }));
  }

  /** Placing a risk on the grid writes impact and likelihood onto that
   * one row; every other edit goes through the shared list. */
  function place(idx: number, patch: Partial<Risk>) {
    updateRisks(risks.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* What a person needs back in their head before naming what could
          go wrong. A definition picked up after a week is the case this
          step was hardest in (Programme Lead, 2026-09-27). */}
      <ContextRecap omit={["risks"]} />

      <div className="flex flex-col items-start gap-3" data-cartograph-region="risk-placing">
        <RiskMatrix
          risks={risks}
          selected={gridPick}
          onPlace={(impact, likelihood) => {
            if (gridPick === null) return;
            place(gridPick, { impact, likelihood });
          }}
        />
        {risks.length > 0 ? (
          <Select value={gridPick === null ? "" : String(gridPick)} onValueChange={(v) => setGridPick(Number(v))}>
            <SelectTrigger className="w-72" aria-label={rc.placePrompt}>
              <SelectValue placeholder={rc.placePrompt} />
            </SelectTrigger>
            <SelectContent>
              {risks.map((r, idx) => (
                <SelectItem key={r.id} value={String(idx)}>
                  {r.description || `#${idx + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <RiskList
          risks={risks}
          phases={store.spec.timeline?.phases ?? []}
          roles={roles}
          onChange={updateRisks}
        />
      </div>
    </div>
  );
}
