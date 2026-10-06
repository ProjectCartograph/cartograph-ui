import { KindExamples } from "@/components/KindExamples";
import { FieldHeading } from "@/components/guidance";
import { LabelsEditor } from "@/components/LabelsEditor";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { SheetAddDialog } from "@/surfaces/sheet/InlineSheetAdd";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useState } from "react";

import { CycleSignature } from "../CycleSignature";
import { knownBaseline, type KPIBaseline, type KPIDefinitionSpec } from "../types";

const kc = copy.kpis.definition;

/** A value and the month it belongs to: a baseline is what was true and
 * when, a target is what should be true and by when. The pair is one
 * thought, so it is one control. */
function ValueAndDate({
  label,
  hint,
  value,
  onChange,
  idPrefix,
  "data-cartograph-field": field,
}: {
  label: string;
  hint: string;
  value?: { value: number; date: string };
  onChange: (next: { value: number; date: string } | undefined) => void;
  idPrefix: string;
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field": string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldHeading label={label} hint={hint} />
      <div className="flex items-center gap-2">
        <Input
          id={`${idPrefix}-value`}
          data-cartograph-field={`${field}/value`}
          type="number"
          className="w-32"
          aria-label={`${label} ${kc.valueLabel}`}
          value={value?.value ?? ""}
          onChange={(e) =>
            e.target.value === "" && !value?.date
              ? onChange(undefined)
              : onChange({ value: Number(e.target.value), date: value?.date ?? "" })
          }
        />
        <Input
          id={`${idPrefix}-date`}
          data-cartograph-field={`${field}/date`}
          className="w-32"
          placeholder={kc.datePlaceholder}
          aria-label={`${label} ${kc.dateLabel}`}
          value={value?.date ?? ""}
          onChange={(e) =>
            e.target.value === "" && value?.value === undefined
              ? onChange(undefined)
              : onChange({ value: value?.value ?? 0, date: e.target.value })
          }
        />
      </div>
    </div>
  );
}

/** The baseline: today's figure, or an admitted unknown with why and when
 * it will be known, as a key result's is (TAXONOMY.md D25). */
function Baseline({ value, onChange }: { value?: KPIBaseline; onChange: (next: KPIBaseline | undefined) => void }) {
  const unknown = !!value && "unknownReason" in value;
  return (
    <div className="flex flex-col gap-2" data-cartograph-field="/spec/baseline">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={unknown ? "unknown" : "known"}
        onValueChange={(v) => {
          if (v === "unknown") onChange({ unknownReason: "" });
          else if (v === "known") onChange(undefined);
        }}
        className="self-start"
      >
        <ToggleGroupItem value="known">{kc.baselineKnown}</ToggleGroupItem>
        <ToggleGroupItem value="unknown">{kc.baselineUnknown}</ToggleGroupItem>
      </ToggleGroup>
      {unknown ? (
        <div className="flex flex-col gap-2">
          <FieldHeading label={kc.baselineLabel} hint={kc.baselineHint} />
          <Input
            data-cartograph-field="/spec/baseline/unknownReason"
            aria-label={kc.unknownReasonLabel}
            placeholder={kc.unknownReasonLabel}
            value={value.unknownReason}
            onChange={(e) => onChange({ ...value, unknownReason: e.target.value })}
          />
          <Input
            data-cartograph-field="/spec/baseline/expectedBy"
            className="w-32"
            aria-label={kc.expectedByLabel}
            placeholder={kc.datePlaceholder}
            value={value.expectedBy ?? ""}
            onChange={(e) => onChange({ unknownReason: value.unknownReason, ...(e.target.value ? { expectedBy: e.target.value } : {}) })}
          />
        </div>
      ) : (
        <ValueAndDate
          label={kc.baselineLabel}
          hint={kc.baselineHint}
          value={knownBaseline(value)}
          onChange={onChange}
          idPrefix="kpi-baseline"
          data-cartograph-field="/spec/baseline"
        />
      )}
    </div>
  );
}

/**
 * What is measured, in what unit, which way is good, from where and how
 * often.
 *
 * Editable here since 2026-09-29. KPI is not a sheet kind — its baseline
 * and target are objects, and a sheet's cells hold values — so until now
 * the only way to change what a measure meant was to edit its file.
 */
export function DefinitionSection() {
  useSectionAutosave();
  const store = useDefinitionStore<KPIDefinitionSpec>();
  const spec = store.spec;
  const set = (patch: Partial<KPIDefinitionSpec>) =>
    store.updateSpec((s) => ({ ...s, ...patch }));
  const { data: goals } = useReferenceOptions("Goal");
  const { data: segments } = useReferenceOptions("Segment");
  const dataSources = useReferenceOptions("DataSource");
  const [addingSegment, setAddingSegment] = useState(false);

  return (
    <div className="flex max-w-3xl flex-col gap-6" data-cartograph-region="kpi-definition">
      <div className="flex flex-col gap-2">
        <FieldHeading label={kc.definitionLabel} hint={kc.definitionHint} htmlFor="kpi-definition" />
        <Textarea
          id="kpi-definition"
          data-cartograph-field="/spec/definition"
          rows={2}
          value={spec.definition ?? ""}
          placeholder={kc.definitionPlaceholder}
          onChange={(e) => set({ definition: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex w-64 flex-col gap-2">
          <FieldHeading label={kc.unitLabel} hint={kc.unitHint} />
          {/* Picked, not typed. Free text spelled the same quantity three
              ways across two vaults; the standard units ship and this
              picker's own add is how an instance declares its own. */}
          <ReferencePicker
            refKind="Unit"
            data-cartograph-field="/spec/unit"
            value={spec.unit}
            onChange={(v) => set({ unit: v || undefined })}
            placeholder={kc.unitPlaceholder}
            label={kc.unitLabel}
          />
        </div>
        <div className="flex flex-col gap-2">
          <FieldHeading label={kc.directionLabel} />
          <Select value={spec.direction ?? ""} onValueChange={(v) => set({ direction: v })}>
            <SelectTrigger className="w-48" aria-label={kc.directionLabel} data-cartograph-field="/spec/direction">
              <SelectValue placeholder={kc.directionPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(copy.kpis.chart.direction).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-8">
        <Baseline value={spec.baseline} onChange={(v) => set({ baseline: v })} />
        <ValueAndDate
          label={kc.targetLabel}
          hint={kc.targetHint}
          value={spec.target}
          onChange={(v) => set({ target: v })}
          idPrefix="kpi-target"
          data-cartograph-field="/spec/target"
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldHeading label={kc.sourceLabel} hint={kc.sourceHint} />
        <ComboboxMultiple
          data-cartograph-field="/spec/sources"
          options={dataSources.data?.options ?? []}
          value={spec.sources ?? (spec.source ? [spec.source] : [])}
          onValueChange={(next) => set({ source: undefined, sources: next.length > 0 ? next : undefined })}
          placeholder={kc.sourcePlaceholder}
          emptyText={kc.sourceNone}
          removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
          aria-label={kc.sourceLabel}
        />
      </div>

      {/* Which goals this measures, and which level of result that makes
          it. Both were readable and neither was editable until
          2026-09-29: the results framework reads its Level column and its
          indicators off exactly these two fields, so a measure that could
          not say either left the matrix to guess. */}
      <div className="flex flex-col gap-2">
        <FieldHeading label={kc.goalsLabel} hint={kc.goalsHint} />
        <ComboboxMultiple
          data-cartograph-field="/spec/goals"
          options={goals?.options ?? []}
          value={spec.goals ?? []}
          onValueChange={(next) => set({ goals: next.length > 0 ? next : undefined })}
          placeholder={kc.goalsPlaceholder}
          emptyText={kc.goalsEmpty}
          removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
          aria-label={kc.goalsLabel}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldHeading label={kc.levelLabel} hint={kc.levelHint} />
        <Select value={spec.resultLevel ?? ""} onValueChange={(v) => set({ resultLevel: v })}>
          <SelectTrigger className="w-64" aria-label={kc.levelLabel} data-cartograph-field="/spec/resultLevel">
            <SelectValue placeholder={kc.levelPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(kc.level).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <FieldHeading label={kc.cycleLabel} hint={kc.cycleHint} />
        <ReferencePicker
          refKind="ReportingCycle"
          data-cartograph-field="/spec/cycle"
          value={spec.cycle}
          onChange={(v) => set({ cycle: v || undefined })}
          placeholder={kc.cyclePlaceholder}
          label={kc.cycleLabel}
        />
        <CycleSignature id={spec.cycle} />
      </div>

      <div className="flex flex-col gap-2">
        <FieldHeading label={kc.splitLabel} hint={kc.splitHint} />
        <KindExamples kind="Segment" compact />
        <ComboboxMultiple
          data-cartograph-field="/spec/disaggregations"
          options={segments?.options ?? []}
          value={spec.disaggregations ?? []}
          onValueChange={(next) => set({ disaggregations: next.length > 0 ? next : undefined })}
          placeholder={kc.splitPlaceholder}
          emptyText={kc.splitEmpty}
          removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
          aria-label={kc.splitLabel}
          onAdd={() => setAddingSegment(true)}
          addLabel={kc.splitAdd}
        />
        <SheetAddDialog
          kind="Segment"
          open={addingSegment}
          onOpenChange={setAddingSegment}
          onAdded={(id) => set({ disaggregations: [...(spec.disaggregations ?? []), id] })}
        />
      </div>

      {/* Not part of what is measured: how somebody wants to find it
          again among a hundred others. Stored on metadata, not spec,
          because it belongs to the manifest rather than to the measure. */}
      <div className="flex flex-col gap-2">
        <FieldHeading label={copy.labels.label} hint={copy.labels.hint} />
        <LabelsEditor labels={store.labels} onChange={store.setLabels} idPrefix="kpi-labels" />
      </div>
    </div>
  );
}
