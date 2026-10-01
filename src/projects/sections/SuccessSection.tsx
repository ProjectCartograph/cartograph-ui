import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Help } from "@/components/guidance";
import { copy } from "@/copy";
import { VocabMark } from "@/components/vocab";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { roleOptions, roleRefLabel, type RoleOption, useResourceNames } from "../RoleRefPicker";
import { SuccessCriterionDialog } from "../SuccessCriterionDialog";
import { useSectionAutosave, useProjectStore } from "../store";
import type { SuccessCriterion, SuccessCriterionWhen } from "../types";

const sc = copy.projects.success;

const GROUPS: SuccessCriterionWhen[] = ["atClosing", "atLanding", "postClosingCycle"];

/**
 * One saved criterion, read as its own sentence with the parts that are
 * not in the sentence shown as marks beneath it. Nothing here is a form:
 * the five parts are edited in the dialog that asked for them.
 */
export function CriterionCard({
  criterion,
  sourceName,
  cycleName,
  roles,
  onEdit,
  onRemove,
}: {
  criterion: SuccessCriterion;
  sourceName?: string;
  cycleName?: string;
  /** The project's roles, so a reference reads as the role's current
   * title rather than as its id. */
  roles: RoleOption[];
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  // The parts, each under its own label, as the charter shows them. The
  // card used to glue them into one sentence, and the glue was where the
  // grammar broke (TAXONOMY.md D19).
  const measured = criterion.metric !== "compliance";

  return (
    <div
      data-slot="criterion-card"
      data-cartograph-region={`criterion-${criterion.id}`}
      className="flex items-start gap-3 rounded-xl p-3 ring-1 ring-foreground/10"
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground" title={sc.metricHint[criterion.metric]}>
        <VocabMark vocab="successMetric" value={criterion.metric} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm text-pretty">{criterion.statement}</p>
        {measured && (criterion.standard || sourceName || cycleName) ? (
          <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs" data-slot="criterion-parts">
            {criterion.standard ? (
              <div className="flex gap-1">
                <dt className="text-muted-foreground">{sc.standard}</dt>
                <dd>{criterion.standard}</dd>
              </div>
            ) : null}
            {sourceName ? (
              <div className="flex gap-1">
                <dt className="text-muted-foreground">{sc.readFrom}</dt>
                <dd>{sourceName}</dd>
              </div>
            ) : null}
            {cycleName ? (
              <div className="flex gap-1">
                <dt className="text-muted-foreground">{sc.each}</dt>
                <dd>{cycleName}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {sc.tracked} {roleRefLabel(criterion.owner, roles) || sc.unset}
          </span>
          <span>
            {sc.confirmed} {roleRefLabel(criterion.confirmedBy, roles) || sc.unset}
          </span>
        </div>
      </div>
      {onEdit ? (
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={onEdit} aria-label={sc.edit}>
          <Pencil />
        </Button>
      ) : null}
      {onRemove ? (
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
      ) : null}
    </div>
  );
}

/**
 * The whole standard, on one step.
 *
 * Closing and Landing used to author their own halves, so the standard
 * was never visible as one thing and the two screens drifted apart. They
 * read their own slice of this now (Programme Lead, 2026-09-27), which
 * closes the gap between them and lets success be thought about over the
 * longer term rather than phase by phase.
 */
export function SuccessSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const criteria = store.spec.successCriteria ?? [];
  const resourceName = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], resourceName);

  const { data: sources } = useReferenceOptions("DataSource");
  const { data: cycles } = useReferenceOptions("ReportingCycle");

  const [editing, setEditing] = useState<{ criterion?: SuccessCriterion; when: SuccessCriterionWhen } | null>(null);

  function save(next: SuccessCriterion) {
    store.updateSpec((s) => {
      const list = s.successCriteria ?? [];
      const at = list.findIndex((x) => x.id === next.id);
      return {
        ...s,
        successCriteria: at === -1 ? [...list, next] : list.map((x, i) => (i === at ? next : x)),
      };
    });
  }

  function remove(id: string) {
    store.updateSpec((s) => ({ ...s, successCriteria: (s.successCriteria ?? []).filter((x) => x.id !== id) }));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {GROUPS.map((when) => {
        const inGroup = criteria.filter((k) => k.when === when);
        return (
          <section key={when} className="flex flex-col gap-3" data-slot={`success-${when}`} data-cartograph-region={`success-${when}`}>
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-medium">{sc.when[when]}</h3>
              <Help label={sc.when[when]} hint={sc.whenHint[when]} />
            </div>
            {inGroup.length === 0 ? <p className="text-sm text-muted-foreground">{sc.empty}</p> : null}
            {inGroup.map((k) => (
              <CriterionCard
                key={k.id}
                criterion={k}
                sourceName={k.source ? sources?.names.get(k.source) : undefined}
                cycleName={k.cycle ? cycles?.names.get(k.cycle) : undefined}
                roles={roles}
                onEdit={() => setEditing({ criterion: k, when })}
                onRemove={() => remove(k.id)}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start border-dashed"
              onClick={() => setEditing({ when })}
            >
              <Plus />
              {sc.add}
            </Button>
          </section>
        );
      })}

      <SuccessCriterionDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        existing={editing?.criterion}
        defaultWhen={editing?.when ?? "atLanding"}
        roles={roles}
        deliverables={(store.spec.deliverables ?? []).flatMap((d) =>
          d.id ? [{ id: d.id, label: d.name || d.id }] : [],
        )}
        onSave={save}
      />
    </div>
  );
}

/**
 * One slice of the standard, read-only, for the phase screens. They show
 * what is due at their own moment and link back to the step that owns
 * it, so nothing is authored twice.
 */
export function CriteriaSlice({
  id,
  whens,
}: {
  id: string;
  whens: SuccessCriterionWhen[];
}) {
  const store = useProjectStore();
  const { data: sources } = useReferenceOptions("DataSource");
  const { data: cycles } = useReferenceOptions("ReportingCycle");
  const resourceName = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], resourceName);
  const shown = (store.spec.successCriteria ?? []).filter((k) => whens.includes(k.when));

  void id;

  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {shown.map((k) => (
        <CriterionCard
          key={k.id}
          criterion={k}
          sourceName={k.source ? sources?.names.get(k.source) : undefined}
          cycleName={k.cycle ? cycles?.names.get(k.cycle) : undefined}
          roles={roles}
        />
      ))}
    </div>
  );
}
