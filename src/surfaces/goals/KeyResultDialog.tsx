import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { Help, QualityMarks, type QualityMark } from "@/components/guidance";
import { copy } from "@/copy";
import { VocabMark } from "@/components/vocab";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { slugify } from "@/surfaces/sheet/schema";
import { joinMetric, splitMetric } from "./sentence";
import {
  isKnownBaseline,
  kindNeedsUnit,
  type KeyResult,
  type KeyResultDirection,
  type KeyResultKind,
} from "./types";

const c = copy.goals.keyResultDialog;

const DIRECTIONS: KeyResultDirection[] = ["increase", "decrease", "reach", "maintain"];
const KINDS: KeyResultKind[] = ["percent", "count", "money", "ratio", "duration"];

// The stock toggle's "on" state is a muted fill, which on a white dialog
// reads as a hover rather than a choice. These are the only controls here
// carrying a decision, so their selected state is the solid one.
const PICKED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary";

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

interface FormState {
  /** The outcome half of the metric. The unit, chosen above, leads the
   * phrase: "process maps" + "published" is stored as one metric. */
  outcome: string;
  direction: KeyResultDirection;
  kind: KeyResultKind;
  unit: string;
  baselineKnown: boolean;
  baselineValue: string;
  baselineDate: string;
  unknownReason: string;
  expectedBy: string;
  targetValue: string;
  targetDate: string;
  source: string;
}

function blankForm(): FormState {
  return {
    outcome: "",
    direction: "reach",
    kind: "count",
    unit: "",
    baselineKnown: true,
    baselineValue: "",
    baselineDate: "",
    unknownReason: "",
    expectedBy: "",
    targetValue: "",
    targetDate: "",
    source: "",
  };
}

function fromKeyResult(kr: KeyResult): FormState {
  const known = isKnownBaseline(kr.baseline);
  return {
    outcome: splitMetric(kr.metric, kr.unit ?? ""),
    direction: kr.direction,
    kind: kr.kind,
    unit: kr.unit ?? "",
    baselineKnown: known || kr.baseline === undefined,
    baselineValue: known ? String((kr.baseline as { value: number }).value) : "",
    baselineDate: known ? (kr.baseline as { date: string }).date : "",
    unknownReason: !known && kr.baseline ? (kr.baseline as { unknownReason: string }).unknownReason : "",
    expectedBy: !known && kr.baseline ? ((kr.baseline as { expectedBy?: string }).expectedBy ?? "") : "",
    targetValue: kr.target ? String(kr.target.value) : "",
    targetDate: kr.target ? kr.target.date : "",
    source: kr.source ?? "",
  };
}

/** What sits next to a number of this kind in its own field: a percent
 * sign, or the unit the person named. */
function fieldSuffix(form: FormState): string {
  if (form.kind === "percent") return "%";
  return form.unit.trim();
}

/** One numbered part of the statement, in the order a strong key result is
 * spoken. Each step carries its own short guidance; none of them is a
 * blank field with no example behind it. */
function Step({
  n,
  title,
  hint,
  examples,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  examples?: string[];
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
      </div>
      <div className="flex flex-col gap-2 pl-7">{children}</div>
    </div>
  );
}

/** The four properties that make a key result strong, lit as they are met,
 * so the person can see what is still missing without reading a paragraph. */
function QualityStrip({ form, allowSource }: { form: FormState; allowSource: boolean }) {
  const marks: QualityMark[] = [
    { key: "measurable", label: c.quality.measurable, met: form.targetValue.trim() !== "" },
    { key: "timeBound", label: c.quality.timeBound, met: /^\d{4}-\d{2}$/.test(form.targetDate) },
  ];
  if (allowSource) {
    marks.push({ key: "verifiable", label: c.quality.verifiable, met: form.source.trim() !== "" });
  }
  return <QualityMarks title={c.quality.title} marks={marks} />;
}

/**
 * The Add / edit key result dialog: typed parts only, assembled into one
 * sentence that builds as the parts are filled. Purely local state; it
 * hands the assembled KeyResult back to the caller on Save, with no server
 * round trip of its own.
 */
export function KeyResultDialog({
  open,
  onOpenChange,
  existing,
  onSave,
  allowSource = true,
  "data-cartograph-field": field,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: KeyResult;
  onSave: (kr: KeyResult) => void;
  /** False for a Goal's own key results (I3.2: the goal is the root of the
   * dependency tree and never references a source or a KPI relation).
   * Project key results keep the default. */
  allowSource?: boolean;
  /** The key result this edits, by JSON pointer (`/spec/keyResults/{id}`,
   * or `/spec/keyResults/-` for a new one); each control names its part
   * under it. */
  "data-cartograph-field"?: string;
}) {
  const at = (part: string) => (field ? `${field}${part}` : undefined);
  const [form, setForm] = useState<FormState>(existing ? fromKeyResult(existing) : blankForm());
  // Set by a Save that could not go through. Reported by the Programme
  // Lead as "it is not possible to apply a key result": Save used to be
  // disabled whenever a required part was empty, so a person who had
  // filled in what they thought was asked met a dead button that said
  // nothing. Save is always live now; a refused one marks the parts it
  // is waiting on, on the controls themselves.
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(existing ? fromKeyResult(existing) : blankForm());
      setRefused(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const example = c.example[form.kind];
  const needsUnit = kindNeedsUnit(form.kind);
  const suffix = fieldSuffix(form);
  // A count, an amount of money or a duration is meaningless without the
  // word for one of them, and the schema refuses the manifest without it:
  // the dialog refuses first, rather than letting the save fail later.
  const unitMissing = needsUnit && form.unit.trim() === "";
  const outcomeMissing = form.outcome.trim() === "";
  const reasonMissing = !form.baselineKnown && form.unknownReason.trim() === "";
  // A figure without its month, or a month without its figure, is half a
  // baseline or target: it used to be dropped without a word on save.
  const halfTarget = (form.targetValue !== "") !== (form.targetDate !== "");
  const halfBaseline = form.baselineKnown && (form.baselineValue !== "") !== (form.baselineDate !== "");
  const canSave = !outcomeMissing && !unitMissing && !reasonMissing && !halfTarget && !halfBaseline;

  // The metric as it will be stored: the unit chosen above, then the
  // outcome word. Nothing types the unit twice.
  const metric = joinMetric(form.unit, form.outcome);

  function handleSave() {
    if (!canSave) {
      setRefused(true);
      return;
    }
    const kr: KeyResult = {
      // Within the 64 characters an id may have, prefix and suffix included.
      id: existing?.id ?? `kr-${slugify(metric).slice(0, 40).replace(/-+$/, "") || "item"}-${randomSuffix()}`,
      metric: metric.trim(),
      direction: form.direction,
      kind: form.kind,
      ...(needsUnit && form.unit.trim() ? { unit: form.unit.trim() } : {}),
    };
    if (form.baselineKnown) {
      if (form.baselineValue !== "" && form.baselineDate !== "") {
        kr.baseline = { value: Number(form.baselineValue), date: form.baselineDate };
      }
    } else if (form.unknownReason.trim() !== "") {
      kr.baseline = {
        unknownReason: form.unknownReason.trim(),
        ...(form.expectedBy ? { expectedBy: form.expectedBy } : {}),
      };
    }
    if (form.targetValue !== "" && form.targetDate !== "") {
      kr.target = { value: Number(form.targetValue), date: form.targetDate };
    }
    if (allowSource && form.source) {
      kr.source = form.source;
    }
    onSave(kr);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] overflow-y-auto sm:max-w-xl"
        data-cartograph-region="key-result-dialog"
        // Escape and a click outside close a dropdown inside it, never the
        // dialog with everything typed: Cancel does that.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{existing ? c.editTitle : c.addTitle}</DialogTitle>
          {/* An example for the kind of number chosen, beside the fields
              rather than inside them, where it read as a value. */}
          <p className="text-sm text-muted-foreground" data-slot="key-result-example">
            {c.exampleLine(example.metric, example.baseline, example.target)}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <Step n={1} title={c.stepDirection} hint={c.stepDirectionHint}>
            <ToggleGroup
              type="single"
              variant="outline"
              value={form.direction}
              data-cartograph-field={at("/direction")}
              onValueChange={(v) => v && set("direction", v as KeyResultDirection)}
            >
              {DIRECTIONS.map((d) => (
                <ToggleGroupItem key={d} value={d} className={PICKED}>
                  <VocabMark vocab="direction" value={d} className="size-3.5" decorative />
                  {c.direction[d]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="pt-1 text-xs font-medium text-muted-foreground">{c.kindLabel}</p>
            <ToggleGroup
              type="single"
              variant="outline"
              value={form.kind}
              data-cartograph-field={at("/kind")}
              onValueChange={(v) => v && set("kind", v as KeyResultKind)}
            >
              {KINDS.map((k) => (
                <ToggleGroupItem key={k} value={k} className={PICKED}>
                  <VocabMark vocab="measureKind" value={k} className="size-3.5" decorative />
                  {c.kind[k]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="grid grid-cols-2 gap-2">
              <InputGroup>
                <InputGroupInput
                  type="number"
                  data-cartograph-field={at("/target/value")}
                  value={form.targetValue}
                  onChange={(e) => set("targetValue", e.target.value)}
                  aria-label={c.targetValueLabel}
                  autoFocus
                />
                {suffix.trim() ? (
                  <InputGroupAddon align="inline-end">{suffix.trim()}</InputGroupAddon>
                ) : null}
              </InputGroup>
              {needsUnit ? (
                <Input
                  data-cartograph-field={at("/unit")}
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  aria-label={c.unitLabel}
                  aria-invalid={refused && unitMissing}
                />
              ) : null}
            </div>
            {needsUnit ? (
              <p className={`text-xs ${refused && unitMissing ? "text-destructive" : "text-muted-foreground"}`}>
                {c.unitHint}
              </p>
            ) : null}
          </Step>

          {/* The unit is already chosen above, so this asks only what
              happens to them: "deliveries" + "checked". Where a kind has no
              unit (a percent, a ratio), it asks for the whole phrase. */}
          <Step n={2} title={needsUnit ? c.stepMetric : c.stepMetricWhole} hint={c.stepMetricHint} examples={c.metricExamples}>
            <InputGroup data-cartograph-field={at("/metric")}>
              {needsUnit && form.unit.trim() ? (
                <InputGroupAddon>
                  <span className="text-muted-foreground">{form.unit.trim()}</span>
                </InputGroupAddon>
              ) : null}
              <InputGroupInput
                value={form.outcome}
                onChange={(e) => set("outcome", e.target.value)}
                aria-label={needsUnit ? c.stepMetric : c.stepMetricWhole}
                aria-invalid={refused && outcomeMissing}
              />
            </InputGroup>
          </Step>

          <Step n={3} title={c.stepWhen} hint={c.stepWhenHint}>
            <MonthPicker
              value={form.targetDate}
              data-cartograph-field={at("/target/date")}
              onChange={(v) => set("targetDate", v)}
              className="max-w-48"
              aria-label={c.targetDateLabel}
            />
            {refused && halfTarget ? <p className="text-xs text-destructive">{c.halfFilled}</p> : null}
          </Step>

          <Step n={4} title={c.stepBaseline} hint={c.stepBaselineHint}>
            <ToggleGroup
              type="single"
              variant="outline"
              value={form.baselineKnown ? "known" : "unknown"}
              data-cartograph-field={at("/baseline")}
              onValueChange={(v) => v && set("baselineKnown", v === "known")}
            >
              <ToggleGroupItem value="known" className={PICKED}>
                {c.baselineKnown}
              </ToggleGroupItem>
              <ToggleGroupItem value="unknown" className={PICKED}>
                {c.baselineUnknown}
              </ToggleGroupItem>
            </ToggleGroup>
            {form.baselineKnown ? (
              <div className="grid grid-cols-2 gap-2">
                <InputGroup>
                  <InputGroupInput
                    type="number"
                    data-cartograph-field={at("/baseline/value")}
                    value={form.baselineValue}
                    onChange={(e) => set("baselineValue", e.target.value)}
                    aria-label={c.baselineValueLabel}
                  />
                  {suffix.trim() ? (
                    <InputGroupAddon align="inline-end">{suffix.trim()}</InputGroupAddon>
                  ) : null}
                </InputGroup>
                <MonthPicker
                  value={form.baselineDate}
                  data-cartograph-field={at("/baseline/date")}
                  onChange={(v) => set("baselineDate", v)}
                  aria-label={c.baselineDateLabel}
                />
                {refused && halfBaseline ? <p className="col-span-2 text-xs text-destructive">{c.halfFilled}</p> : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  value={form.unknownReason}
                  data-cartograph-field={at("/baseline/unknownReason")}
                  onChange={(e) => set("unknownReason", e.target.value)}
                  aria-label={c.unknownReasonLabel}
                  aria-invalid={refused && reasonMissing}
                />
                <MonthPicker
                  value={form.expectedBy}
                  data-cartograph-field={at("/baseline/expectedBy")}
                  onChange={(v) => set("expectedBy", v)}
                  className="max-w-48"
                  aria-label={c.expectedByLabel}
                />
              </div>
            )}
          </Step>

          {allowSource ? (
            <Step n={5} title={c.stepSource} hint={c.stepSourceHint}>
              <ReferencePicker
                refKind="DataSource"
                value={form.source || undefined}
                data-cartograph-field={at("/source")}
                onChange={(v) => set("source", v ?? "")}
                addLabel={c.addSource}
              />
            </Step>
          ) : null}

          <QualityStrip form={form} allowSource={allowSource} />
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
    </Dialog>
  );
}
