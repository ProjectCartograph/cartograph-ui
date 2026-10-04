import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy, plusNoun } from "@/copy";
import { ProblemCard } from "@/projects/ProblemCard";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { ProblemLine } from "@/projects/types";
import type { ProgrammeSpec } from "../types";

const pc = copy.programmes;

/**
 * What is wrong that this programme answers.
 *
 * The same editor a project's problems use, because they are the same
 * shape and the same thing: a statement about a group of people, citing
 * the Gaps it addresses rather than restating them.
 */
export function ProblemsSection() {
  useSectionAutosave();
  const store = useDefinitionStore<ProgrammeSpec>();
  const { data: groups } = useReferenceOptions("BeneficiaryGroup");
  const problems = store.spec.problems ?? [];
  const [open, setOpen] = useState<number | null>(0);

  function setProblems(next: ProblemLine[]) {
    store.updateSpec((s) => ({ ...s, problems: next.length > 0 ? next : undefined }));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3" data-cartograph-region="problems">
      {problems.length === 0 ? <p className="text-sm text-muted-foreground">{pc.problemsEmpty}</p> : null}
      {problems.map((line, idx) => (
        <ProblemCard
          list="/spec/problems"
          key={idx}
          index={idx}
          line={line}
          groupOptions={groups?.options ?? []}
          open={open === idx}
          onOpenChange={(o) => setOpen(o ? idx : null)}
          canRemove={problems.length > 1}
          onChange={(patch) => setProblems(problems.map((p, i) => (i === idx ? { ...p, ...patch } : p)))}
          onRemove={() => setProblems(problems.filter((_, i) => i !== idx))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start border-dashed"
        onClick={() => {
          setProblems([...problems, { problem: {}, change: {} }]);
          setOpen(problems.length);
        }}
       aria-label={pc.addProblem}>
        <Plus />
        {plusNoun(pc.addProblem)}
      </Button>
    </div>
  );
}
