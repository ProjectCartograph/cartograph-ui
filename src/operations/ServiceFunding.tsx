import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldHeading } from "@/components/guidance";
import { copy, plusNoun } from "@/copy";
import { CURRENCY_OPTIONS } from "@/projects/currencies";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useDefinitionStore } from "@/definition/store";
import type { OperationSpec, ServiceFundingLine } from "./types";

const oc = copy.operations;
const pc = copy.projects.resources;

/**
 * What pays to run the service (TAXONOMY.md D39): the project's funding
 * line with the period its amount is for, since a running cost recurs
 * for as long as the service runs. Asked beside the service owner.
 */
export function ServiceFunding() {
  const store = useDefinitionStore<OperationSpec>();
  const lines = store.spec.funding ?? [];

  function setLines(next: ServiceFundingLine[]) {
    store.updateSpec((s) => ({ ...s, funding: next.length > 0 ? next : undefined }));
  }

  function update(idx: number, patch: Partial<ServiceFundingLine>) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  return (
    <section className="flex flex-col gap-2" data-cartograph-region="service-funding">
      <FieldHeading label={oc.fundingLabel} hint={oc.fundingHint} />
      {lines.length === 0 ? <p className="text-sm text-muted-foreground">{oc.fundingEmpty}</p> : null}
      {lines.map((f, idx) => (
        <div key={idx} className="flex flex-col gap-2 rounded-lg border p-3" data-cartograph-region={`service-funding-${idx}`}>
          <div className="flex items-center gap-2">
            <Input
              data-cartograph-field={`/spec/funding/${idx}/amount`}
              type="number"
              min={0}
              value={f.amount}
              onChange={(e) => update(idx, { amount: Number(e.target.value) })}
              aria-label={oc.fundingAmountLabel}
              className="w-32 shrink-0"
            />
            <div className="w-28 shrink-0">
              <Combobox
                options={CURRENCY_OPTIONS}
                value={f.currency || undefined}
                onValueChange={(v) => update(idx, { currency: v ?? "" })}
                placeholder={pc.currencyLabel}
                searchPlaceholder={pc.currencySearchPlaceholder}
                emptyText={pc.currencyEmpty}
                aria-label={pc.currencyLabel}
                data-cartograph-field={`/spec/funding/${idx}/currency`}
              />
            </div>
            <Select value={f.per} onValueChange={(v) => update(idx, { per: v as ServiceFundingLine["per"] })}>
              <SelectTrigger className="w-28 shrink-0" aria-label={oc.fundingPerLabel} data-cartograph-field={`/spec/funding/${idx}/per`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(oc.fundingPer).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={f.status} onValueChange={(v) => update(idx, { status: v as ServiceFundingLine["status"] })}>
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
              onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              aria-label={copy.projects.common.remove}
            >
              <X />
            </Button>
          </div>
          <div className="pr-9">
            <ReferencePicker
              data-cartograph-field={`/spec/funding/${idx}/source`}
              refKind="FundingSource"
              value={f.source}
              onChange={(v) => update(idx, { source: v || undefined })}
              placeholder={pc.fundingSourcePlaceholder}
              label={pc.fundingSourceLabel}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start border-dashed"
        onClick={() => setLines([...lines, { amount: 0, currency: "", per: "year", status: "requested" }])}
        aria-label={oc.addFunding}
      >
        <Plus />
        {plusNoun(oc.addFunding)}
      </Button>
    </section>
  );
}
