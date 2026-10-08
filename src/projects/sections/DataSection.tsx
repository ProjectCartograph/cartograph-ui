import { ArrowDownToLine, ArrowUpFromLine, Plus, X } from "lucide-react";

import { Suggested } from "@/components/relevance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldHeading, Help } from "@/components/guidance";
import { copy, plusNoun } from "@/copy";
import { VocabOption } from "@/components/vocab";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { LineageGraph } from "./LineageGraph";
import { useSectionAutosave, useProjectStore } from "../store";
import type { DataConsumeItem, DataOutput, DataProduceItem } from "../types";

const dc = copy.projects.data;

/** One row of a card: its own heading, then the control. Every box on
 * this screen says what it is asking for. The middle one used to be a
 * bare input with a placeholder, and nobody could tell whether it wanted
 * the use, the owner or the contents (Programme Lead, 2026-09-27). */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldHeading label={label} hint={hint} />
      {children}
    </div>
  );
}

/** A card with its own remove, used by both halves. */
function Row({ onRemove, region, children }: { onRemove: () => void; region: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border p-3" data-cartograph-region={region}>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
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

function EnumSelect<T extends string>({
  value,
  onChange,
  label,
  vocab,
  words,
  "data-cartograph-field": field,
}: {
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
  value: string;
  onChange: (next: T) => void;
  label: string;
  vocab: "handoff" | "personalData" | "refresh" | "dataOutput";
  words: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="w-full" aria-label={label} data-cartograph-field={field}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {Object.keys(words).map((v) => (
          <SelectItem key={v} value={v}>
            <VocabOption vocab={vocab} value={v} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * How this project interacts with data, and how it changes it (Programme
 * Lead, 2026-09-27). Two halves, and they are not mirror images:
 *
 * What it reads is a source, why it is read, and how it arrives. Nothing
 * on that side changes.
 *
 * What it creates is the half that was thin. Data that is produced has to
 * land somewhere or nobody can find it again, so every output names a
 * sink, and says what shape it is: a register the project stands up
 * itself, rows in something that already exists, documents that land in a
 * store, or a periodic extract. A shared document site and an object
 * store are both data sources in the register, declared once and picked
 * here like any other.
 */
export function DataSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const consumes = store.spec.data?.consumes ?? [];
  const produces = store.spec.data?.produces ?? [];

  function updateConsumes(next: DataConsumeItem[]) {
    store.updateSpec((s) => ({ ...s, data: { ...s.data, consumes: next } }));
  }
  function updateProduces(next: DataProduceItem[]) {
    store.updateSpec((s) => ({ ...s, data: { ...s.data, produces: next } }));
  }
  function patchConsume(idx: number, patch: Partial<DataConsumeItem>) {
    updateConsumes(consumes.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }
  function patchProduce(idx: number, patch: Partial<DataProduceItem>) {
    updateProduces(produces.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  return (
    <div className="flex flex-col gap-6">
      <LineageGraph
        project={store.id}
        name={store.name}
        uses={consumes.map((c) => c.source).filter(Boolean)}
        produces={produces.map((p) => p.sink).filter(Boolean)}
        onAddUse={() => updateConsumes([...consumes, { source: "", purpose: "" }])}
        onAddOutput={() => updateProduces([...produces, { output: "recordsInExistingSource", sink: "", purpose: "", personalData: "none" }])}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-3" data-cartograph-region="data-uses">
        <div className="flex items-center gap-1">
          <Label className="flex items-center gap-2">
            <ArrowDownToLine className="size-4 text-muted-foreground" aria-hidden="true" />
            {dc.usesTitle}
          </Label>
          <Help label={dc.usesTitle} hint={dc.usesHint} />
        </div>
        {/* Never what the project already names, used or produced: the
            model finds a project's own outputs most relevant of all, but
            what is there is no longer a suggestion. */}
        <Suggested
          kind="DataSource"
          selected={[]}
          exclude={(m) => consumes.some((c) => c.source === m.id) || produces.some((p) => p.sink === m.id)}
          onPick={(id) => updateConsumes([...consumes, { source: id, purpose: "" }])}
        />
        {consumes.length === 0 ? <p className="text-sm text-muted-foreground">{dc.usesEmpty}</p> : null}
        {consumes.map((c, idx) => (
          <Row key={idx} region={`data-use-${idx}`} onRemove={() => updateConsumes(consumes.filter((_, i) => i !== idx))}>
            <Field label={dc.sourceLabel}>
              <ReferencePicker
                data-cartograph-field={`/spec/data/consumes/${idx}/source`}
                refKind="DataSource"
                value={c.source || undefined}
                onChange={(v) => patchConsume(idx, { source: v ?? "" })}
                placeholder={dc.sourcePlaceholder}
                label={dc.sourceLabel}
                addLabel={dc.addSourceToRegister}
              />
            </Field>
            <Field label={dc.usePurposeLabel}>
              <Input
                data-cartograph-field={`/spec/data/consumes/${idx}/purpose`}
                value={c.purpose}
                onChange={(e) => patchConsume(idx, { purpose: e.target.value })}
                placeholder={dc.usePurposePlaceholder}
                aria-label={dc.usePurposeLabel}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={dc.handoffLabel}>
                <EnumSelect
                  data-cartograph-field={`/spec/data/consumes/${idx}/handoff`}
                  value={c.handoff ?? ""}
                  onChange={(v) => patchConsume(idx, { handoff: v as DataConsumeItem["handoff"] })}
                  label={dc.handoffLabel}
                  vocab="handoff"
                  words={dc.handoff}
                />
              </Field>
              <Field label={dc.personalDataLabel}>
                <EnumSelect
                  data-cartograph-field={`/spec/data/consumes/${idx}/personalData`}
                  value={c.personalData ?? ""}
                  onChange={(v) => patchConsume(idx, { personalData: v as DataConsumeItem["personalData"] })}
                  label={dc.personalDataLabel}
                  vocab="personalData"
                  words={dc.personalData}
                />
              </Field>
            </div>
          </Row>
        ))}
        <Button
          type="button"
          variant="outline"
          className="self-start border-dashed"
          onClick={() => updateConsumes([...consumes, { source: "", purpose: "" }])}
         aria-label={dc.addUse}>
          <Plus />
          {plusNoun(dc.addUse)}
        </Button>
      </div>

      <div className="flex flex-col gap-3" data-cartograph-region="data-outputs">
        <div className="flex items-center gap-1">
          <Label className="flex items-center gap-2">
            <ArrowUpFromLine className="size-4 text-muted-foreground" aria-hidden="true" />
            {dc.producesTitle}
          </Label>
          <Help label={dc.producesTitle} hint={dc.producesHint} />
        </div>
        {produces.length === 0 ? <p className="text-sm text-muted-foreground">{dc.producesEmpty}</p> : null}
        {produces.map((p, idx) => (
          <Row key={idx} region={`data-output-${idx}`} onRemove={() => updateProduces(produces.filter((_, i) => i !== idx))}>
            <Field label={dc.outputLabel}>
              <EnumSelect
                data-cartograph-field={`/spec/data/produces/${idx}/output`}
                value={p.output ?? ""}
                onChange={(v) => patchProduce(idx, { output: v as DataOutput })}
                label={dc.outputLabel}
                vocab="dataOutput"
                words={dc.output}
              />
            </Field>
            {/* The sink is a data source like any other, so a project that
                delivers its own register picks the register it delivers,
                and one that writes reports picks the store they land in. */}
            <Field
              label={dc.sinkLabel}
              hint={p.output === "newDataSource" ? dc.sinkNewSource : undefined}
            >
              <ReferencePicker
                data-cartograph-field={`/spec/data/produces/${idx}/sink`}
                refKind="DataSource"
                value={p.sink || undefined}
                onChange={(v) => patchProduce(idx, { sink: v ?? "" })}
                placeholder={dc.sinkPlaceholder}
                label={dc.sinkLabel}
                addLabel={dc.addSinkToRegister}
              />
            </Field>
            <Field label={dc.producePurposeLabel}>
              <Input
                data-cartograph-field={`/spec/data/produces/${idx}/purpose`}
                value={p.purpose}
                onChange={(e) => patchProduce(idx, { purpose: e.target.value })}
                placeholder={dc.producePurposePlaceholder}
                aria-label={dc.producePurposeLabel}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={dc.refreshLabel}>
                <EnumSelect
                  data-cartograph-field={`/spec/data/produces/${idx}/refresh`}
                  value={p.refresh ?? ""}
                  onChange={(v) => patchProduce(idx, { refresh: v as DataProduceItem["refresh"] })}
                  label={dc.refreshLabel}
                  vocab="refresh"
                  words={dc.refresh}
                />
              </Field>
              <Field label={dc.personalDataLabel}>
                <EnumSelect
                  data-cartograph-field={`/spec/data/produces/${idx}/personalData`}
                  value={p.personalData ?? ""}
                  onChange={(v) => patchProduce(idx, { personalData: v as DataProduceItem["personalData"] })}
                  label={dc.personalDataLabel}
                  vocab="personalData"
                  words={dc.personalData}
                />
              </Field>
            </div>
          </Row>
        ))}
        <Button
          type="button"
          variant="outline"
          className="self-start border-dashed"
          onClick={() =>
            updateProduces([
              ...produces,
              { output: "recordsInExistingSource", sink: "", purpose: "", personalData: "none" },
            ])
          }
         aria-label={dc.addOutput}>
          <Plus />
          {plusNoun(dc.addOutput)}
        </Button>
      </div>
      </div>
    </div>
  );
}
