import { useState } from "react";

import { copy } from "@/copy";
import { ContextRecap } from "../ContextRecap";
import { RiskList } from "../RiskList";
import { roleOptions, useResourceNames } from "../RoleRefPicker";
import { RiskMatrix } from "../RiskMatrix";
import { bearsOnOf } from "../constraints/triangle";
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
  // The risk in hand: the one picked, else the first not yet placed.
  const firstUnplaced = risks.findIndex((r) => !(r.impact && r.likelihood));
  const pick = gridPick ?? (firstUnplaced >= 0 ? firstUnplaced : null);

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
          selected={pick}
          onPlace={(impact, likelihood) => {
            if (pick === null) return;
            place(pick, { impact, likelihood });
            // On to the next risk not yet placed, if there is one.
            const next = risks.findIndex((r, i) => i !== pick && !(r.impact && r.likelihood));
            setGridPick(next >= 0 ? next : null);
          }}
        />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {pick !== null && risks[pick] ? rc.placeNow(risks[pick].description || `#${pick + 1}`) : risks.length > 0 ? rc.placeHow : null}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <RiskList
          risks={risks}
          phases={store.spec.timeline?.phases ?? []}
          roles={roles}
          onChange={updateRisks}
          placing={pick}
          onPlace={setGridPick}
          triangle={bearsOnOf(store.spec)}
        />
      </div>
    </div>
  );
}
