import { Grid3x3, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy, plusNoun } from "@/copy";
import { VocabOption } from "@/components/vocab";
import { DependencyEdgeEditor } from "./DependencyEdgeEditor";
import { seg } from "./field";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { RoleRefPicker, type RoleOption } from "./RoleRefPicker";
import { retypeRisk, type Risk, type RiskType, type TimelinePhase } from "./types";

const rc = copy.projects.risks;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * The risk list a project and a programme both keep: risks, issues,
 * dependencies, assumptions and constraints, with the edge on the
 * dependency type.
 *
 * Lifted out of the project's own section on 2026-09-28 so a programme
 * could use it. A programme holds risk at programme level and the
 * dependencies between programmes are the graph worth drawing; what it
 * does not hold is a timeline, so `phases` arrives empty and a dependency
 * lands by no phase of its own.
 */
export function RiskList({
  risks,
  phases,
  roles,
  onChange,
  field = "/spec/risks",
  placing,
  onPlace,
}: {
  /** The risk being placed on the impact and likelihood grid, if any. */
  placing?: number | null;
  /** Picks a risk to place on the grid; left out, no grid is shown. */
  onPlace?: (idx: number) => void;
  /** The list's own pointer; each risk is named under it. */
  field?: string;
  risks: Risk[];
  phases: TimelinePhase[];
  /** The roles a decision can be handed up to. A programme names none, so
   * it writes who decides in words. */
  roles?: RoleOption[];
  onChange: (next: Risk[]) => void;
}) {
  function update(idx: number, patch: Partial<Risk>) {
    onChange(risks.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  /** Puts a whole row back, for a change that removes a field rather than
   * setting one: a patch can only add. */
  function replace(idx: number, next: Risk) {
    onChange(risks.map((r, i) => (i === idx ? next : r)));
  }
  function remove(idx: number) {
    onChange(risks.filter((_, i) => i !== idx));
  }

  const at = (r: Risk, idx: number, rest: string) => `${field}/${seg(r, idx)}/${rest}`;

  return (
    <div className="flex flex-col gap-3" data-cartograph-region="risk-list">
        {risks.length === 0 ? <p className="text-sm text-muted-foreground">{rc.empty}</p> : null}
      {risks.map((r, idx) => (
        <div key={r.id} data-cartograph-region={`risk-${idx}`} className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-start gap-2">
          <Select
            value={r.type}
            onValueChange={(v) => replace(idx, retypeRisk(r, v as RiskType))}
          >
            <SelectTrigger className="w-40" aria-label={rc.typeLabel} data-cartograph-field={at(r, idx, "type")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(rc.type).map(([value]) => (
                <SelectItem key={value} value={value}>
                  <VocabOption vocab="riskType" value={value} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            data-cartograph-field={at(r, idx, "description")}
            value={r.description}
            onChange={(e) => update(idx, { description: e.target.value.slice(0, 160) })}
            placeholder={rc.descriptionPlaceholder}
            aria-label={rc.descriptionLabel}
            maxLength={160}
            className="flex-1"
          />
          {onPlace ? (
            <Button
              type="button"
              variant={placing === idx ? "secondary" : "outline"}
              size="sm"
              aria-pressed={placing === idx}
              onClick={() => onPlace(idx)}
              aria-label={rc.placeOnGrid(r.description || `#${idx + 1}`)}
              title={rc.placeOnGrid(r.description || `#${idx + 1}`)}
            >
              <Grid3x3 />
              {r.impact && r.likelihood ? rc.moveShort : rc.placeShort}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(idx)}
            aria-label={copy.projects.common.remove}
          >
            <X />
          </Button>
        </div>
        {/* Only a dependency carries an edge; a kind rule refuses it
            on any other type, and switching type away drops it. */}
        {r.type === "dependency" ? (
          <DependencyEdgeEditor
            data-cartograph-field={at(r, idx, "depends")}
            value={r.depends}
            phases={phases}
            onChange={(depends) => update(idx, { depends })}
          />
        ) : null}
        <Input
          data-cartograph-field={at(r, idx, "mitigation")}
          value={r.mitigation ?? ""}
          onChange={(e) => update(idx, { mitigation: e.target.value.slice(0, 160) })}
          placeholder={rc.mitigationPlaceholder}
          aria-label={rc.mitigationLabel}
          maxLength={160}
        />
        {/* How likely it is to be caught in time (FMEA, engine TAXONOMY.md
            D58): with impact and likelihood, its risk priority. */}
        <div className="flex items-center gap-2" data-cartograph-field={at(r, idx, "detection")}>
          <Label className="w-24 shrink-0 text-muted-foreground" title={rc.detectionHint}>
            {rc.detectionLabel}
          </Label>
          {(["low", "medium", "high"] as const).map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={r.detection === d ? "secondary" : "outline"}
              aria-pressed={r.detection === d}
              onClick={() => update(idx, { detection: r.detection === d ? undefined : d })}
              aria-label={`${rc.detectionLabel}: ${rc.detection[d]}`}
              title={rc.detectionHint}
            >
              {rc.detection[d]}
            </Button>
          ))}
        </div>
        {/* Who manages it day to day (TAXONOMY.md D41): a role on the
            work, a governance body, or, where the work names no roles, an
            entry in the catalogue. A high-impact risk without one warns. */}
        <div className="flex items-center gap-2">
          <Label className="w-24 shrink-0 text-muted-foreground">{rc.ownerLabel}</Label>
          {roles && roles.length > 0 ? (
            <RoleRefPicker
              data-cartograph-field={at(r, idx, "owner")}
              value={r.owner}
              options={roles}
              onChange={(owner) => update(idx, { owner })}
              label={rc.ownerLabel}
              placeholder={rc.ownerPlaceholder}
              withBodies
              className="w-56"
            />
          ) : (
            <div className="w-56">
              <ReferencePicker
                data-cartograph-field={at(r, idx, "owner")}
                refKind="Resource"
                value={r.owner?.kind === "Resource" ? r.owner.id : undefined}
                onChange={(id) => update(idx, { owner: id ? { kind: "Resource", id } : undefined })}
                label={rc.ownerLabel}
                placeholder={rc.ownerPlaceholder}
              />
            </div>
          )}
        </div>
        {/* Escalating hands a decision up to someone with more authority
            than the work: so it says who, and why (PRINCE2, GovS 002). A
            bare "escalated" flag told a reader neither. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`risk-escalate-${idx}`}
              data-cartograph-field={at(r, idx, "escalate/flag")}
              checked={!!r.escalate?.flag}
              onCheckedChange={(checked) =>
                update(idx, { escalate: checked ? { ...r.escalate, flag: true } : { flag: false } })
              }
            />
            <Label htmlFor={`risk-escalate-${idx}`}>{rc.escalateLabel}</Label>
          </div>
          {r.escalate?.flag ? (
            <div className="flex flex-wrap items-center gap-2 pl-6">
              {roles && roles.length > 0 ? (
                <RoleRefPicker
                  data-cartograph-field={at(r, idx, "escalate/to/id")}
                  value={r.escalate.to}
                  options={roles}
                  onChange={(to) => update(idx, { escalate: { ...r.escalate!, to } })}
                  label={rc.escalateToLabel}
                  placeholder={rc.escalateToLabel}
                  withBodies
                  className="w-56"
                />
              ) : (
                <Input
                  data-cartograph-field={at(r, idx, "escalate/to/external")}
                  value={r.escalate.to?.external ?? ""}
                  onChange={(e) =>
                    update(idx, { escalate: { ...r.escalate!, to: { external: e.target.value.slice(0, 80) } } })
                  }
                  aria-label={rc.escalateToLabel}
                  placeholder={rc.escalateToLabel}
                  className="w-56"
                />
              )}
              <Input
                data-cartograph-field={at(r, idx, "escalate/reason")}
                value={r.escalate.reason ?? ""}
                onChange={(e) => update(idx, { escalate: { ...r.escalate!, flag: true, reason: e.target.value.slice(0, 160) } })}
                aria-label={rc.escalateReasonLabel}
                placeholder={rc.escalateReasonLabel}
                maxLength={160}
                className="min-w-48 flex-1"
              />
            </div>
          ) : null}
        </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start border-dashed"
        onClick={() => onChange([...risks, { id: `r-${randomSuffix()}`, description: "", type: "risk" }])}
        title={rc.add}
        aria-label={rc.add}
      >
        <Plus />
        {plusNoun(rc.addShort)}
      </Button>
    </div>
  );
}
