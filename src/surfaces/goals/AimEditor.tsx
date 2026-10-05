import { Input } from "@/components/ui/input";
import { QualityMarks, type QualityMark } from "@/components/guidance";
import { copy } from "@/copy";
import { hasDigit } from "@/components/guide";

const ac = copy.goals.editor.aim;

/**
 * A goal's statement, written whole in the writer's own language (engine
 * TAXONOMY.md D36): what the organisation sets out to do for a goal or an
 * objective, what will be true for an outcome. The guidance beside it says
 * which, with examples; no opening verb is picked from a list.
 */
export function AimEditor({
  level,
  value,
  onChange,
  maxLength,
  "data-cartograph-field": field,
}: {
  level: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  /** The manifest field the statement is, by JSON pointer. */
  "data-cartograph-field"?: string;
}) {
  const marks: QualityMark[] = [{ key: "numbers", label: ac.marks.noNumbers, met: value.trim() !== "" && !hasDigit(value) }];
  return (
    <div className="flex flex-col gap-2">
      <Input
        id="goal-objective"
        data-cartograph-field={field}
        aria-label={level === "outcome" ? ac.stateLabel : ac.restLabel}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="text-base"
      />
      <QualityMarks title={ac.marksTitle} marks={marks} />
    </div>
  );
}
