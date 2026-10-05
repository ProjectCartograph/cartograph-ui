import { useState } from "react";
import { Plus } from "lucide-react";

import { FromIdea } from "@/components/FromIdea";
import { Button } from "@/components/ui/button";
import { FieldHeading } from "@/components/guidance";
import { copy, plusNoun } from "@/copy";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { ContextRecap } from "../ContextRecap";
import { ProblemCard } from "../ProblemCard";
import { useSectionAutosave, useProjectStore } from "../store";
import type { ProblemLine } from "../types";

const ac = copy.projects.aim;

/**
 * Quality, step two: what is wrong today, and what will be different. By
 * whose decision the project exists is governance (TAXONOMY.md D33), and
 * asked there. It follows Beneficiaries, so every
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

  // A sentence of the idea goes into the first problem that has none,
  // or a new one when every problem has.
  function fillFirst(part: "problem" | "change", sentence: string) {
    store.updateSpec((s) => {
      const list = [...(s.summary.problems ?? [])];
      const at = list.findIndex((p) => !(part === "problem" ? p.problem?.situation : p.change?.what));
      const i = at >= 0 ? at : list.length;
      const line = list[i] ?? { problem: {}, change: {} };
      list[i] = part === "problem" ? { ...line, problem: { ...line.problem, situation: sentence } } : { ...line, change: { ...line.change, what: sentence } };
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

  return (
    <div className="flex flex-col gap-6">
      <ContextRecap omit={["aim", "measures", "deliverables"]} />

      <div className="flex flex-col gap-3" data-cartograph-region="problems">
        <FromIdea field="/spec/summary/problems/-/problem/situation" onUse={(t) => fillFirst("problem", t)} />
        <FromIdea field="/spec/summary/problems/-/change/what" onUse={(t) => fillFirst("change", t)} />
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

    </div>
  );
}
