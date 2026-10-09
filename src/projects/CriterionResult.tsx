import { useState } from "react";
import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copy } from "@/copy";
import { today, useEvents } from "./sections/ApprovalSection";
import type { SuccessCriterion } from "./types";

const rc = copy.projects.criterionResult;
const ac = copy.projects.approval;

/**
 * A success criterion's result where it is judged, at closing or at
 * landing (engine TAXONOMY.md D52): met or not, the value measured, the
 * evidence and when, recorded as an event in the change set; once recorded,
 * what was found, and who entered it once the change set is rolled in.
 */
export function CriterionResult({ criterion }: { criterion: SuccessCriterion }) {
  const { record, last } = useEvents();
  const found = last("successCriteria", criterion.id);
  const judged = found && (found.happened === "met" || found.happened === "notMet") ? found : undefined;
  const [met, setMet] = useState<"met" | "notMet" | "">("");
  const [value, setValue] = useState("");
  const [evidence, setEvidence] = useState("");
  const [date, setDate] = useState(today());
  if (judged) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm" data-criterion-result={criterion.id}>
        <CheckCheck className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">{ac.happenedWords[judged.happened]}</span>
        {judged.value !== undefined ? <span>{judged.value}</span> : null}
        <span className="text-muted-foreground">{judged.date}</span>
        {judged.evidence ? <span className="text-muted-foreground">({judged.evidence})</span> : null}
        <span className="text-xs text-muted-foreground">{judged.recordedBy ?? ac.mergeToStamp}</span>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2" data-criterion-result={criterion.id} role="group" aria-label={rc.label(criterion.statement)}>
      <ToggleGroup type="single" size="sm" variant="outline" value={met} onValueChange={(v) => setMet(v as typeof met)} aria-label={rc.judged}>
        <ToggleGroupItem value="met">{ac.happenedWords.met}</ToggleGroupItem>
        <ToggleGroupItem value="notMet">{ac.happenedWords.notMet}</ToggleGroupItem>
      </ToggleGroup>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {rc.value}
        <Input type="number" className="h-8 w-28" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {ac.evidence}
        <Input className="h-8 w-56" value={evidence} maxLength={240} onChange={(e) => setEvidence(e.target.value.slice(0, 240))} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {rc.date}
        <Input type="date" className="h-8 w-40" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <Button
        type="button"
        size="sm"
        disabled={!met || !date}
        onClick={() =>
          met &&
          record({
            on: { local: "successCriteria", id: criterion.id },
            happened: met,
            date,
            ...(value !== "" ? { value: Number(value) } : {}),
            ...(evidence.trim() ? { evidence: evidence.trim() } : {}),
          })
        }
        aria-label={rc.record(criterion.statement)}
      >
        <CheckCheck />
        {rc.recordShort}
      </Button>
    </div>
  );
}
