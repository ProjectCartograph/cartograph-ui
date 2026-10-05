import { useExamples } from "@/components/examples";
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
  alignedGoals,
  onChange,
  "data-cartograph-field": field,
}: {
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
  objective: string;
  /** How many goals this project serves, for the "Aligned" mark. */
  alignedGoals: number;
  onChange: (next: string) => void;
}) {
  const examples = useExamples("objective", gc.objectiveExamples);
  const written = objective.trim() !== "";
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
