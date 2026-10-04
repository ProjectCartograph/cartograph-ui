import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { FieldHeading } from "@/components/guidance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy, plusNoun } from "@/copy";
import { useProjectStore } from "../store";
import type { Mandate } from "../types";

const ac = copy.projects.aim;

/** On whose authority the project exists: the decisions, approvals and
 * plans it works under. Part of governance (TAXONOMY.md D33). */
export function MandateSection() {
  const store = useProjectStore();
  const mandate = store.spec.mandate ?? [];
  function updateMandate(idx: number, patch: Partial<Mandate>) {
    store.updateSpec((s) => {
      const next = [...(s.mandate ?? [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, mandate: next };
    });
  }
  function addMandate() {
    store.updateSpec((s) => ({ ...s, mandate: [...(s.mandate ?? []), { kind: "decision", title: "" }] }));
  }
  function removeMandate(idx: number) {
    store.updateSpec((s) => ({ ...s, mandate: (s.mandate ?? []).filter((_, i) => i !== idx) }));
  }

  return (
    <div className="flex flex-col gap-2" data-cartograph-region="mandates">
      <FieldHeading label={ac.mandateTitle} examples={ac.mandateExamples} />
      <div className="flex flex-col gap-2">
        {mandate.length === 0 ? <p className="text-sm text-muted-foreground">{ac.mandateEmpty}</p> : null}
        {mandate.map((m, idx) => (
          <div key={idx} data-cartograph-region={`mandate-${idx}`} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Select value={m.kind} onValueChange={(v) => updateMandate(idx, { kind: v as Mandate["kind"] })}>
                <SelectTrigger className="w-36 shrink-0" aria-label={ac.mandateKindLabel} data-cartograph-field={`/spec/mandate/${idx}/kind`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ac.mandateKind).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                data-cartograph-field={`/spec/mandate/${idx}/title`}
                value={m.title}
                onChange={(e) => updateMandate(idx, { title: e.target.value.slice(0, 120) })}
                placeholder={ac.mandateTitlePlaceholder}
                aria-label={ac.mandateTitleLabel}
                maxLength={120}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => removeMandate(idx)}
                aria-label={copy.projects.common.remove}
              >
                <X />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 pr-9">
              <Input
                data-cartograph-field={`/spec/mandate/${idx}/reference`}
                value={m.reference ?? ""}
                onChange={(e) => updateMandate(idx, { reference: e.target.value.slice(0, 80) })}
                placeholder={ac.mandateReferencePlaceholder}
                aria-label={ac.mandateReferenceLabel}
                maxLength={80}
              />
              <DatePicker
                data-cartograph-field={`/spec/mandate/${idx}/date`}
                value={m.date}
                onChange={(v) => updateMandate(idx, { date: v || undefined })}
                placeholder={ac.mandateDateLabel}
                aria-label={ac.mandateDateLabel}
              />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" className="self-start border-dashed" onClick={addMandate} aria-label={ac.addMandate}>
          <Plus />
          {plusNoun(ac.addMandate)}
        </Button>
      </div>
    </div>
  );
}
