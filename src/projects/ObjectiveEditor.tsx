import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Undo2 } from "lucide-react";

import { useExamples } from "@/components/examples";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { hasDigit } from "@/components/guide";
import { Help, QualityMarks, type QualityMark } from "@/components/guidance";
import { copy } from "@/copy";

const gc = copy.projects.goals;

/**
 * The objective, written whole: what the project changes and how, in one
 * sentence in the writer's own language and word order (engine TAXONOMY.md
 * D36). No verb is picked from a list and nothing is split on "by": the
 * guidance's examples say what a good one says, beside the field. The
 * marks are what can be told from the sentence itself, and none is met by
 * a sentence not yet written.
 */
export function ObjectiveEditor({
  objective,
  about,
  alignedGoals,
  onChange,
  "data-cartograph-field": field,
}: {
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
  objective: string;
  /** What the project is about, from Context: usually the objective too,
   * so it is offered rather than typed again (#57). */
  about?: string;
  /** How many goals this project serves, for the "Aligned" mark. */
  alignedGoals: number;
  onChange: (next: string) => void;
}) {
  const examples = useExamples("objective", gc.objectiveExamples);
  const written = objective.trim() !== "";
  const said = (about ?? "").trim();
  // It reads as an objective when it carries no number (the kind's rule)
  // and fits: then it is written in for the person to refine. Otherwise
  // it is offered, with what to change.
  const fits = said !== "" && !hasDigit(said) && said.length <= 240;
  const [taken, setTaken] = useState(false);
  const offered = useRef(false);
  useEffect(() => {
    if (!offered.current && !written && fits) {
      offered.current = true;
      onChange(said);
      setTaken(true);
    }
  }, [written, fits, said, onChange]);
  const marks: QualityMark[] = [
    { key: "aligned", label: gc.objectiveQuality.aligned, met: alignedGoals > 0 },
    // The kind rule: an objective carrying a number is a key result
    // wearing the wrong hat, and the server refuses it. An empty one has
    // no numbers, and has nothing else yet either.
    { key: "qualitative", label: gc.objectiveQuality.qualitative, met: written && !hasDigit(objective) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <label htmlFor="project-objective" className="text-sm font-medium">
          {gc.objectiveStepOutcome}
        </label>
        <Help label={gc.objectiveStepOutcome} hint={gc.objectiveStepOutcomeHint} examples={examples} />
      </div>
      {taken && objective === said ? (
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2 text-sm" data-cartograph-region="objective-from-about">
          <p className="flex-1 text-pretty text-muted-foreground">{gc.objectiveFromAbout}</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setTaken(false); }} aria-label={gc.objectiveFromAboutUndo} title={gc.objectiveFromAboutUndo}>
            <Undo2 />
            {gc.objectiveFromAboutUndoShort}
          </Button>
        </div>
      ) : null}
      {!written && said !== "" && !fits ? (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2 text-sm" data-cartograph-region="objective-from-about">
          <p className="text-pretty">
            <span className="text-muted-foreground">{gc.objectiveAboutSaid} </span>
            {said}
          </p>
          <p className="text-pretty text-muted-foreground">{hasDigit(said) ? gc.objectiveAboutHasNumbers : gc.objectiveAboutTooLong}</p>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange(said.slice(0, 240))} aria-label={gc.objectiveAboutUse} title={gc.objectiveAboutUse}>
            <ArrowDownToLine />
            {gc.objectiveAboutUseShort}
          </Button>
        </div>
      ) : null}
      <Textarea
        id="project-objective"
        data-cartograph-field={field}
        value={objective}
        onChange={(e) => onChange(e.target.value.slice(0, 240))}
        rows={2}
        maxLength={240}
      />
      <QualityMarks title={gc.objectiveQualityTitle} marks={marks} />
    </div>
  );
}
