import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Suggested } from "@/components/relevance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FieldHeading, Help } from "@/components/guidance";
import { copy, plusNoun } from "@/copy";
import { CURRENCIES } from "../currencies";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useSectionAutosave, useProjectStore } from "../store";
import type { FundingLine, ProjectRole, ProjectRoleKind } from "../types";
import { seg } from "../field";

const pc = copy.projects.resources;

// Built once: 170 options rebuilt on every keystroke is 170 objects a
// render, and the list never changes.
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

// Every role a project names here. Stakeholders are named further down the
// same page, in their own block: a stakeholder is not a resource the
// project spends, but both answer the same question, which is what this
// step is for.
const ROLE_KINDS: ProjectRoleKind[] = [
  "sponsor",
  "manager",
  "teamMember",
  "userRepresentative",
  "technicalLead",
  "dataOwner",
  "dataCustodian",
  "dataSteward",
  "projectSupport",
  "serviceOwner",
];

/** The two roles a charter cannot be handed off without. */
const REQUIRED_ROLES: { role: ProjectRoleKind; label: string }[] = [
  { role: "sponsor", label: pc.sponsorLabel },
  { role: "manager", label: pc.leadLabel },
];

/**
 * One role this project names. A top-level component, not one declared
 * inside the section's own render: a component created fresh every render
 * loses its state (here, focus inside its own Input) every keystroke.
 */
function RoleRow({
  entry,
  index,
  onUpdate,
  onRemove,
}: {
  entry: ProjectRole;
  index: number;
  onUpdate: (patch: Partial<ProjectRole>) => void;
  onRemove: () => void;
}) {
  const field = `/spec/resources/${seg(entry, index)}`;
  return (
    <div className="flex items-start gap-3 rounded-xl p-3 ring-1 ring-foreground/10" data-cartograph-region={`role-${index}`}>
      <div className="w-48 shrink-0">
        <Select value={entry.role} onValueChange={(v) => onUpdate({ role: v as ProjectRoleKind })}>
          <SelectTrigger className="w-full" aria-label={pc.roleLabel} data-cartograph-field={`${field}/role`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {pc.roleKind[k] ?? k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* One naming. A free-text title sat above this until 2026-09-29
            and nobody could tell it from the catalogue entry below it;
            the vaults had it holding "Sponsor" on a row already typed
            sponsor as often as a name. */}
        <ReferencePicker
          data-cartograph-field={`${field}/resource`}
          refKind="Resource"
          value={entry.resource}
          onChange={(v) => onUpdate({ resource: v || undefined })}
          placeholder={pc.resourcePlaceholder}
          label={`${pc.resourceLabel} ${index + 1}`}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label={copy.projects.common.remove}
      >
        <X />
      </Button>
    </div>
  );
}


/**
 * One step for everything a project needs around it: the roles it names,
 * the funding envelope it draws on, and the stakeholders it must keep
 * close. The organisation's own charter groups these the same way, under
 * "Stakeholders and Resources", and the charter template puts money and
 * staffing in one section rather than filing the budget under scope.
 *
 * There is no accountability grid. A RACI's rows are deliverables and
 * decisions, which is a planning judgement about work, not about the
 * paragraphs of a definition; where accountability is decided here, it is
 * decided on the deliverable, in its own acceptance criteria.
 */
export function ResourcesSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const [nextRole, setNextRole] = useState<ProjectRoleKind>("sponsor");

  const resources = store.spec.resources ?? [];
  const funding = store.spec.funding ?? [];

  const roleRows = resources.map((r, idx) => ({ r, idx }));
  // A component answers to its parent's sponsor, so it needs only its own
  // manager (TAXONOMY.md D15), as the engine's resources-sponsor-lead check reads it.
  const component = !!store.spec.alignment?.partOf;
  const required = component ? REQUIRED_ROLES.filter(({ role }) => role !== "sponsor") : REQUIRED_ROLES;

  function setResources(next: ProjectRole[]) {
    store.updateSpec((spec) => ({ ...spec, resources: next }));
  }
  function updateAt(idx: number, patch: Partial<ProjectRole>) {
    const next = [...resources];
    next[idx] = { ...next[idx], ...patch };
    setResources(next);
  }
  function removeAt(idx: number) {
    setResources(resources.filter((_, i) => i !== idx));
  }
  function addRole() {
    setResources([...resources, { role: nextRole }]);
  }

  function updateFunding(idx: number, patch: Partial<FundingLine>) {
    store.updateSpec((s) => {
      const next = [...(s.funding ?? [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, funding: next };
    });
  }
  function addFunding() {
    store.updateSpec((s) => ({
      ...s,
      funding: [...(s.funding ?? []), { amount: 0, currency: "", source: "", status: "requested" }],
    }));
  }
  function removeFunding(idx: number) {
    store.updateSpec((s) => ({ ...s, funding: (s.funding ?? []).filter((_, i) => i !== idx) }));
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3" data-cartograph-region="required-roles">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium">{pc.requiredTitle}</p>
          <Help label={pc.requiredTitle} hint={component ? pc.requiredHintComponent : pc.requiredHint} />
        </div>
        <div className="flex flex-wrap gap-2">
          {required.map(({ role, label }) => {
            const present = roleRows.some(({ r }) => r.role === role);
            return (
              <Badge key={role} variant={present ? "secondary" : "outline"} className="gap-1 font-normal">
                {present ? <Check className="size-3 text-success" /> : null}
                {label}
              </Badge>
            );
          })}
        </div>
      </div>

      <section className="flex flex-col gap-3" data-cartograph-region="roles">
        <div className="flex items-center gap-1">
          <h2 className="text-base font-semibold">{pc.listTitle}</h2>
          <Help label={pc.listTitle} hint={pc.listHint} />
        </div>

        {roleRows.length === 0 ? <p className="text-sm text-muted-foreground">{pc.empty}</p> : null}

        {roleRows.map(({ r, idx }) => (
          <RoleRow
            key={idx}
            entry={r}
            index={idx}
            onUpdate={(patch) => updateAt(idx, patch)}
            onRemove={() => removeAt(idx)}
          />
        ))}

        <div className="flex items-center gap-2">
          <Select value={nextRole} onValueChange={(v) => setNextRole(v as ProjectRoleKind)}>
            <SelectTrigger className="w-40" aria-label={pc.roleLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {pc.roleKind[k] ?? k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className="border-dashed" onClick={addRole} aria-label={pc.addRole}>
            <Plus />
            {plusNoun(pc.addRole)}
          </Button>
        </div>

      </section>

      <Separator />

      <section className="flex flex-col gap-3" data-cartograph-region="funding">
        <FieldHeading label={pc.fundingTitle} hint={pc.fundingHint} />
        <div className="flex flex-col gap-2">
          <Suggested
            kind="FundingSource"
            selected={funding.map((f) => f.source ?? "").filter(Boolean)}
            onPick={(id) =>
              store.updateSpec((s) => {
                const cur = s.funding ?? [];
                return {
                  ...s,
                  funding: cur.some((f) => f.source === id)
                    ? cur.filter((f) => f.source !== id)
                    : [...cur, { amount: 0, currency: "", source: id, status: "requested" }],
                };
              })
            }
          />
          {funding.length === 0 ? <p className="text-sm text-muted-foreground">{pc.fundingEmpty}</p> : null}
          {funding.map((f, idx) => (
            <div key={idx} className="flex flex-col gap-2 rounded-lg border p-3" data-cartograph-region={`funding-${idx}`}>
              <div className="flex items-center gap-2">
                <Input
                  data-cartograph-field={`/spec/funding/${idx}/amount`}
                  type="number"
                  value={f.amount}
                  onChange={(e) => updateFunding(idx, { amount: Number(e.target.value) })}
                  placeholder="0"
                  aria-label={pc.amountLabel}
                  className="w-32 shrink-0"
                />
                {/* Picked, not typed: a box that takes any three capitals
                    takes a typo, and the list is a published standard. */}
                {/* Wrapped rather than sized by its own className: the
                    combobox's trigger wrapper is w-full, so a width on the
                    trigger let it eat the row and squeeze Status to 20px. */}
                <div className="w-28 shrink-0">
                  <Combobox
                    options={CURRENCY_OPTIONS}
                    value={f.currency || undefined}
                    onValueChange={(v) => updateFunding(idx, { currency: v ?? "" })}
                    placeholder={pc.currencyLabel}
                    searchPlaceholder={pc.currencySearchPlaceholder}
                    emptyText={pc.currencyEmpty}
                    aria-label={pc.currencyLabel}
                    data-cartograph-field={`/spec/funding/${idx}/currency`}
                  />
                </div>
                <Select
                  value={f.status}
                  onValueChange={(v) => updateFunding(idx, { status: v as FundingLine["status"] })}
                >
                  <SelectTrigger className="min-w-0 flex-1" aria-label={pc.fundingStatusLabel} data-cartograph-field={`/spec/funding/${idx}/status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(pc.fundingStatus).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => removeFunding(idx)}
                  aria-label={copy.projects.common.remove}
                >
                  <X />
                </Button>
              </div>
              {/* Which budget, and nothing else. It was two free-text
                  boxes until 2026-09-29 \u2014 one asking which budget in
                  prose, one whose placeholder read like a ledger code
                  nobody could place. The budget is declared once now and
                  carries its own code. */}
              <div className="pr-9">
                <ReferencePicker
                  data-cartograph-field={`/spec/funding/${idx}/source`}
                  refKind="FundingSource"
                  value={f.source}
                  onChange={(v) => updateFunding(idx, { source: v || undefined })}
                  placeholder={pc.fundingSourcePlaceholder}
                  label={pc.fundingSourceLabel}
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="self-start border-dashed" onClick={addFunding} aria-label={pc.addFunding}>
            <Plus />
            {plusNoun(pc.addFunding)}
          </Button>
        </div>
      </section>
    </div>
  );
}
