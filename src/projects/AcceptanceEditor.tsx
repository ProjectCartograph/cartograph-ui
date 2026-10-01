import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { NameRoleDialog } from "./NameRoleDialog";
import { RoleRefPicker, roleOptions, type RoleOption, useResourceNames } from "./RoleRefPicker";
import { useProjectStore } from "./store";
import type { AcceptanceCriterion, Deliverable, Ref } from "./types";
import { seg } from "./field";

const dc = copy.projects.deliverables;

/**
 * What makes a deliverable accepted, and who says so.
 *
 * One implementation, two placements. Deliverables is where these are
 * written; Closing is where they are read back and adjusted, because
 * they *are* the closing test and re-authoring them somewhere else in a
 * different shape is what made that step unanswerable (Programme Lead,
 * 2026-09-27). Both edit the same `deliverables[].acceptance[]`, so
 * there is nothing to keep in step.
 */

/**
 * One acceptance criterion: the role that verifies it, then what that
 * role confirms. A top-level component, not one declared inside a
 * section's own render, so its inputs keep focus between keystrokes.
 */
function CriterionRow({
  criterion,
  index,
  options,
  onUpdate,
  onRemove,
  onAddRole,
  field,
}: {
  /** The criterion's own pointer. */
  field: string;
  criterion: AcceptanceCriterion;
  index: number;
  options: RoleOption[];
  onUpdate: (patch: Partial<AcceptanceCriterion>) => void;
  onRemove: () => void;
  onAddRole: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-2 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <RoleRefPicker
        data-cartograph-field={`${field}/by`}
        value={criterion.by}
        options={options}
        onChange={(by) => onUpdate({ by })}
        onAddRole={onAddRole}
        label={dc.acceptanceByLabel}
        placeholder={dc.acceptanceByPlaceholder}
        className="w-44 shrink-0"
      />
      {/* The test wraps rather than scrolling out of sight: a hundred and
          sixty characters never fit on one line beside its verifier. */}
      <Textarea
        data-cartograph-field={`${field}/outcome`}
        value={criterion.outcome}
        onChange={(e) => onUpdate({ outcome: e.target.value.slice(0, 160) })}
        placeholder={dc.acceptanceOutcomePlaceholder}
        aria-label={`${dc.acceptanceOutcomeLabel} ${index + 1}`}
        maxLength={160}
        rows={2}
        className="min-h-0 min-w-0 flex-1 resize-none"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        onClick={onRemove}
        aria-label={copy.projects.common.remove}
      >
        <X />
      </Button>
    </div>
  );
}

/**
 * The acceptance criteria of one deliverable, with the add-a-verifier
 * flow behind them. Writes straight to the store, so wherever it is
 * placed it is editing the one copy.
 */
export function AcceptanceEditor({ index }: { index: number }) {
  const store = useProjectStore();
  const deliverables = store.spec.deliverables ?? [];
  const resourceName = useResourceNames();
  const options = roleOptions(store.spec.resources ?? [], resourceName);
  const criteria = deliverables[index]?.acceptance ?? [];
  const [addRoleFor, setAddRoleFor] = useState<number | null>(null);

  function update(patch: Partial<Deliverable>) {
    store.updateSpec((s) => {
      const next = [...(s.deliverables ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...s, deliverables: next };
    });
  }

  /** The shared dialog has already filed the role; this only points the
   * criterion that asked for one at it. */
  function selectNamed(by: Ref) {
    const criterionIndex = addRoleFor;
    if (criterionIndex === null) return;
    update({ acceptance: criteria.map((c, ci) => (ci === criterionIndex ? { ...c, by } : c)) });
    setAddRoleFor(null);
  }

  return (
    <div className="flex flex-col gap-2" data-cartograph-region={`acceptance-${index}`}>
      {criteria.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dc.acceptanceEmpty}</p>
      ) : (
        criteria.map((c, cIdx) => (
          <CriterionRow
            key={cIdx}
            criterion={c}
            index={cIdx}
            field={`/spec/deliverables/${seg(deliverables[index], index)}/acceptance/${cIdx}`}
            options={options}
            onUpdate={(patch) =>
              update({ acceptance: criteria.map((x, i) => (i === cIdx ? { ...x, ...patch } : x)) })
            }
            onRemove={() => update({ acceptance: criteria.filter((_, i) => i !== cIdx) })}
            onAddRole={() => setAddRoleFor(cIdx)}
          />
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start border-dashed"
        onClick={() => update({ acceptance: [...criteria, { outcome: "" }] })}
        title={dc.addAcceptance}
        aria-label={dc.addAcceptance}
      >
        <Plus />
        {dc.addAcceptanceShort}
      </Button>
      <NameRoleDialog
        open={addRoleFor !== null}
        onOpenChange={(o) => !o && setAddRoleFor(null)}
        onNamed={selectNamed}
      />
    </div>
  );
}
