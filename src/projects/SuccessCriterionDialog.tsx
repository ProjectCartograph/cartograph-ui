import { useExamples } from "@/components/examples";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Help, QualityMarks, type QualityMark } from "@/components/guidance";
import { VocabMark } from "@/components/vocab";
import { copy } from "@/copy";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { SheetAddDialog } from "@/surfaces/sheet/InlineSheetAdd";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { NameRoleDialog } from "./NameRoleDialog";
import { RoleRefPicker, type RoleOption } from "./RoleRefPicker";
import { StandardPicker } from "./StandardPicker";
import {
  SUCCESS_METRICS,
  refIsSet,
  type Ref,
  type SuccessCriterion,
  type SuccessCriterionWhen,
  type SuccessMetric,
} from "./types";

const sc = copy.projects.success;
const c = sc.dialog;

const WHENS: SuccessCriterionWhen[] = ["atClosing", "atLanding", "postClosingCycle"];

// The stock toggle's "on" state is a muted fill, which on a white dialog
// reads as a hover rather than a choice.
const PICKED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary";

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** One numbered part of the criterion, in the order a strong one is
 * spoken. Each step is one of the questions worth asking early, and
 * carries its own short guidance; none of them is a blank field with no
 * example behind it. */
function Step({
  n,
  title,
  hint,
  examples,
  optional,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  examples?: string[];
  /** Shown as such: a step nobody has to answer should say so, or it
   * reads as a question the criterion is missing. */
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
          {n}
        </span>
        <div className="flex items-center gap-1">
          <Label className="text-sm">{title}</Label>
          <Help label={title} hint={hint} examples={examples} />
        </div>
        {optional ? (
          <span className="text-xs text-muted-foreground">{copy.projects.success.dialog.optional}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 pl-7">{children}</div>
    </div>
  );
}

/** The sentinel the role pickers use for "name a role that does not
 * exist yet"; never stored. */

/** Picks a role the project has already declared, or names one on the
 * spot. Two of the five parts are roles, and both are positions: the one
 * that tracks the number, and the one that confirms the project
 * succeeded. Neither is a RACI letter.
 *
 * Resources comes before this step, so the list is rarely empty; the
 * naming stays for the role nobody thought of until they needed it
 * (Programme Lead, 2026-09-27). */

interface FormState {
  statement: string;
  metric: SuccessMetric | "";
  standard: string;
  source: string;
  cycle: string;
  owner: Ref | undefined;
  confirmedBy: Ref | undefined;
  when: SuccessCriterionWhen;
  from?: Ref[];
  assumes?: string[];
}

function blank(when: SuccessCriterionWhen): FormState {
  return {
    statement: "",
    metric: "",
    standard: "",
    source: "",
    cycle: "",
    owner: undefined,
    confirmedBy: undefined,
    when,
  };
}

function fromCriterion(k: SuccessCriterion): FormState {
  return {
    statement: k.statement,
    metric: k.metric,
    standard: k.standard ?? "",
    source: k.source ?? "",
    cycle: k.cycle ?? "",
    owner: k.owner,
    confirmedBy: k.confirmedBy,
    when: k.when,
    from: k.from,
    assumes: k.assumes,
  };
}

/**
 * The five questions, as five steps.
 *
 * A success criterion is the floor a project must clear, and it is not
 * an objective's key result: an objective is meant to be aspirational,
 * so a team can miss an ambitious target and still have succeeded. That
 * is why neither is generated from the other, and why this dialog asks
 * for its own measurement rather than borrowing one.
 *
 * Two of the five parts reuse registers Cartograph already keeps. The method
 * of measurement is a DataSource, the frequency is a ReportingCycle, and
 * both can be added here without abandoning the criterion.
 */
export function SuccessCriterionDialog({
  open,
  onOpenChange,
  existing,
  defaultWhen,
  roles,
  deliverables,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: SuccessCriterion;
  defaultWhen: SuccessCriterionWhen;
  /** The roles this project has declared, as references can point at
   * them. */
  roles: RoleOption[];
  /** The project's own deliverables, so a criterion can name the outputs
   * behind it where any produce it. */
  deliverables: { id: string; label: string }[];
  onSave: (criterion: SuccessCriterion) => void;
}) {
  const [form, setForm] = useState<FormState>(existing ? fromCriterion(existing) : blank(defaultWhen));
  const statementExamples = useExamples("success.statement", c.step1Examples);
  // Save is always live; a refused one marks the parts it is waiting on,
  // on the controls themselves.
  const [refused, setRefused] = useState(false);
  // Which of the two role questions asked for a role to be named.
  const [naming, setNaming] = useState<"owner" | "confirmedBy" | null>(null);

  const [addingAssumption, setAddingAssumption] = useState(false);
  const { data: assumptions } = useReferenceOptions("Assumption");
  const deliverableOptions = deliverables.map((d) => ({ value: d.id, label: d.label }));
  const assumptionOptions = assumptions?.options ?? [];


  useEffect(() => {
    if (open) {
      setForm(existing ? fromCriterion(existing) : blank(defaultWhen));
      setRefused(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id, defaultWhen]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Compliance is satisfied, not measured, so it is never asked for a
  // standard, a source or a cycle.
  const measured = form.metric !== "" && form.metric !== "compliance";
  const statementMissing = form.statement.trim() === "";
  const metricMissing = form.metric === "";
  const confirmerMissing = !refIsSet(form.confirmedBy);
  const canSave = !statementMissing && !metricMissing && !confirmerMissing;

  const marks: QualityMark[] = [
    { key: "stated", label: c.quality.stated, met: !statementMissing },
    { key: "measured", label: c.quality.measured, met: measured ? form.standard.trim() !== "" : !metricMissing },
    { key: "sourced", label: c.quality.sourced, met: measured ? form.source !== "" && form.cycle !== "" : !metricMissing },
    { key: "owned", label: c.quality.owned, met: refIsSet(form.owner) },
    { key: "confirmed", label: c.quality.confirmed, met: !confirmerMissing },
  ];

  function handleSave() {
    if (!canSave) {
      setRefused(true);
      return;
    }
    const criterion: SuccessCriterion = {
      id: existing?.id ?? `sc-${slugify(form.statement) || "line"}-${randomSuffix()}`,
      statement: form.statement.trim(),
      metric: form.metric as SuccessMetric,
      confirmedBy: form.confirmedBy as Ref,
      when: form.when,
      ...(measured && form.standard.trim() ? { standard: form.standard.trim() } : {}),
      ...(measured && form.source ? { source: form.source } : {}),
      ...(measured && form.cycle ? { cycle: form.cycle } : {}),
      ...(refIsSet(form.owner) ? { owner: form.owner } : {}),
      ...((form.from?.length ?? 0) > 0 ? { from: form.from } : {}),
      ...((form.assumes?.length ?? 0) > 0 ? { assumes: form.assumes } : {}),
    };
    onSave(criterion);
    onOpenChange(false);
  }

  const field = `/spec/successCriteria/${existing ? `{${existing.id}}` : "-"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl" data-cartograph-region="dialog-success-criterion">
        <DialogHeader>
          <DialogTitle>{existing ? c.editTitle : c.addTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <Step n={1} title={c.step1} hint={c.step1Hint} examples={statementExamples}>
            <Textarea
              data-cartograph-field={`${field}/statement`}
              value={form.statement}
              onChange={(e) => set("statement", e.target.value.slice(0, 160))}
              aria-label={c.step1}
              aria-invalid={refused && statementMissing}
              maxLength={160}
              rows={2}
              className="min-h-0 resize-none"
              autoFocus
            />
          </Step>

          <Step n={2} title={c.step2} hint={c.step2Hint}>
            <ToggleGroup
              type="single"
              variant="outline"
              value={form.metric}
              onValueChange={(v) => v && set("metric", v as SuccessMetric)}
              data-cartograph-field={`${field}/metric`}
              className="flex-wrap"
              aria-invalid={refused && metricMissing}
            >
              {SUCCESS_METRICS.map((m) => (
                <ToggleGroupItem key={m} value={m} className={PICKED} title={sc.metricHint[m]}>
                  <VocabMark vocab="successMetric" value={m} className="size-3.5" decorative />
                  {sc.metric[m]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {measured ? <StandardPicker data-cartograph-field={`${field}/standard`} value={form.standard} onChange={(v) => set("standard", v)} /> : null}
          </Step>

          {/* Compliance skips the measurement steps entirely rather than
              showing them greyed: a question that cannot apply is not
              asked. */}
          {measured ? (
            <Step n={3} title={c.step3} hint={c.step3Hint}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ReferencePicker
                  data-cartograph-field={`${field}/source`}
                  refKind="DataSource"
                  value={form.source || undefined}
                  onChange={(v) => set("source", v ?? "")}
                  placeholder={c.sourcePlaceholder}
                  label={c.sourceLabel}
                  addLabel={c.addSource}
                />
                <ReferencePicker
                  data-cartograph-field={`${field}/cycle`}
                  refKind="ReportingCycle"
                  value={form.cycle || undefined}
                  onChange={(v) => set("cycle", v ?? "")}
                  placeholder={c.cyclePlaceholder}
                  label={c.cycleLabel}
                  addLabel={c.addCycle}
                />
              </div>
            </Step>
          ) : null}

          <Step n={measured ? 4 : 3} title={c.step4} hint={c.step4Hint}>
            <RoleRefPicker
              data-cartograph-field={`${field}/owner`}
              value={form.owner}
              options={roles}
              onChange={(v) => set("owner", v)}
              onAddRole={() => setNaming("owner")}
              label={c.ownerLabel}
              placeholder={c.rolePlaceholder}
              className="w-full"
            />
          </Step>

          <Step n={measured ? 5 : 4} title={c.step5} hint={c.step5Hint}>
            <RoleRefPicker
              data-cartograph-field={`${field}/confirmedBy`}
              value={form.confirmedBy}
              options={roles}
              onChange={(v) => set("confirmedBy", v)}
              onAddRole={() => setNaming("confirmedBy")}
              label={c.confirmedByLabel}
              placeholder={c.rolePlaceholder}
              className="w-full"
            />
            <p className="pt-1 text-xs font-medium text-muted-foreground">{c.whenLabel}</p>
            <ToggleGroup
              type="single"
              variant="outline"
              value={form.when}
              onValueChange={(v) => v && set("when", v as SuccessCriterionWhen)}
              data-cartograph-field={`${field}/when`}
              className="flex-wrap"
            >
              {WHENS.map((w) => (
                <ToggleGroupItem key={w} value={w} className={PICKED} title={sc.whenHint[w]}>
                  {sc.when[w]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Step>

          {/* Optional, and last, because it is an enrichment rather than
              a question the criterion needs answered. A criterion may be
              produced by a deliverable, and may equally assess schedule,
              budget, compliance or any dimension no deliverable produces
              (Programme Lead, 2026-09-29). */}
          <Step n={(measured ? 5 : 4) + 1} title={c.step6} hint={c.step6Hint} optional>
            <ComboboxMultiple
              options={deliverableOptions}
              value={(form.from ?? []).map((r) => r.id ?? "").filter(Boolean)}
              onValueChange={(next) =>
                set("from", next.length > 0 ? next.map((id) => ({ local: "deliverables", id })) : undefined)
              }
              placeholder={c.fromPlaceholder}
              emptyText={c.fromNone}
              removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
              aria-label={c.step6}
              data-cartograph-field={`${field}/from`}
            />
            <p className="pt-1 text-xs font-medium text-muted-foreground">{c.assumesLabel}</p>
            <ComboboxMultiple
              options={assumptionOptions}
              value={form.assumes ?? []}
              onValueChange={(next) => set("assumes", next.length > 0 ? next : undefined)}
              placeholder={c.assumesPlaceholder}
              emptyText={c.assumesNone}
              removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
              aria-label={c.assumesLabel}
              data-cartograph-field={`${field}/assumes`}
              onAdd={() => setAddingAssumption(true)}
              addLabel={c.assumesAdd}
            />
          </Step>

          <QualityMarks title={c.quality.title} marks={marks} />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {c.cancel}
          </Button>
          <Button type="button" onClick={handleSave}>
            {c.save}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Files the role in Resources and selects it on the question that
          asked, so naming one never costs the criterion being written. */}
      <SheetAddDialog
        kind="Assumption"
        open={addingAssumption}
        onOpenChange={setAddingAssumption}
        onAdded={(id) => set("assumes", [...(form.assumes ?? []), id])}
      />

      <NameRoleDialog
        open={naming !== null}
        onOpenChange={(o) => !o && setNaming(null)}
        onNamed={(ref) => {
          if (naming) set(naming, ref);
          setNaming(null);
        }}
      />
    </Dialog>
  );
}
