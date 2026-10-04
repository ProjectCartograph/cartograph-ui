import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { FieldHeading } from "@/components/guidance";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy, plusNoun } from "@/copy";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { ContextRecap } from "../ContextRecap";
import { ProblemCard } from "../ProblemCard";
import { useSectionAutosave, useProjectStore } from "../store";
import type { Mandate, ProblemLine } from "../types";

const ac = copy.projects.aim;

/**
 * Quality, step two: what is wrong today, what will be different, and by
 * whose decision this project exists. It follows Beneficiaries, so every
 * sentence is built about groups already named rather than about a
 * placeholder. Nothing measurable here yet; the numbers arrive in Refine.
 *
 * A project may answer more than one problem, and one change may land
 * differently on different groups (Programme Lead, 2026-09-27), so the
 * pairs are a list of cards rather than two fields. Only one card is open
 * at a time: eight fields times four problems is not a step anybody
 * finishes.
 */
export function AimSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const mandate = store.spec.mandate ?? [];
  const problems = store.spec.summary.problems ?? [];

  // Only the groups this project already named are offered: a problem
  // felt by somebody nobody listed is a beneficiary nobody listed.
  const { data: groupOptions } = useReferenceOptions("BeneficiaryGroup");
  const named = (store.spec.summary.beneficiaries ?? []).map((b) => b.group);
  const options = named.map((id) => ({ value: id, label: groupOptions?.names.get(id) ?? id }));

  const [openIndex, setOpenIndex] = useState(0);

  function updateProblem(idx: number, patch: Partial<ProblemLine>) {
    // Changing the groups changes the sentence and not a word anybody
    // wrote: the subject is composed from `groups` at read time, so there
    // is nothing stored to restate (Programme Lead, 2026-09-29).
    store.updateSpec((s) => {
      const list = [...(s.summary.problems ?? [])];
      if (!list[idx]) return s;
      list[idx] = { ...list[idx], ...patch };
      return { ...s, summary: { ...s.summary, problems: list } };
    });
  }

  function addProblem() {
    store.updateSpec((s) => ({
      ...s,
      summary: { ...s.summary, problems: [...(s.summary.problems ?? []), { problem: {}, change: {} }] },
    }));
    setOpenIndex(problems.length);
  }

  function removeProblem(idx: number) {
    store.updateSpec((s) => ({
      ...s,
      summary: { ...s.summary, problems: (s.summary.problems ?? []).filter((_, i) => i !== idx) },
    }));
    setOpenIndex((n) => (n >= idx && n > 0 ? n - 1 : n));
  }

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
    <div className="flex flex-col gap-6">
      <ContextRecap omit={["aim", "measures", "deliverables"]} />

      <div className="flex flex-col gap-3" data-cartograph-region="problems">
        <FieldHeading label={ac.problemsTitle} />
        {problems.map((line, idx) => (
          <ProblemCard
            key={idx}
            line={line}
            index={idx}
            open={openIndex === idx}
            onOpenChange={(open) => setOpenIndex(open ? idx : -1)}
            groupOptions={options}
            onChange={(patch) => updateProblem(idx, patch)}
            onRemove={() => removeProblem(idx)}
            canRemove={problems.length > 1}
          />
        ))}
        <Button type="button" variant="outline" className="self-start border-dashed" onClick={addProblem} aria-label={ac.addProblem}>
          <Plus />
          {plusNoun(ac.addProblem)}
        </Button>
      </div>

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
    </div>
  );
}
