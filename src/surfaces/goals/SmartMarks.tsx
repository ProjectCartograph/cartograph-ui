import { copy } from "@/copy";
import type { GoalNode } from "./tree-types";

type Smart = GoalNode["smart"];

const LETTERS: { key: keyof Smart; letter: string }[] = [
  { key: "specific", letter: "S" },
  { key: "measurable", letter: "M" },
  { key: "attainable", letter: "A" },
  { key: "relevant", letter: "R" },
  { key: "timeBound", letter: "T" },
];

/**
 * The five SMART letters (TAXONOMY.md D25), filled where the record meets
 * the criterion and outlined where it does not. Shape carries the state as
 * well as tone, so it reads the same printed in black and white.
 */
export function SmartMarks({ smart, className }: { smart?: Smart; className?: string }) {
  if (!smart) return null;
  const sc = copy.smart;
  const met = LETTERS.filter((l) => smart[l.key]).length;
  const label = `${sc.title}: ${LETTERS.map((l) => `${sc.names[l.key]} ${smart[l.key] ? sc.met : sc.notMet}`).join(", ")}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-slot="smart-marks"
      data-met={met}
      className={`inline-flex shrink-0 gap-px font-mono text-[10px] leading-none ${className ?? ""}`}
    >
      {LETTERS.map((l) => (
        <span
          key={l.key}
          aria-hidden="true"
          className={
            smart[l.key]
              ? "flex size-3.5 items-center justify-center rounded-[3px] border border-foreground bg-foreground font-semibold text-background"
              : "flex size-3.5 items-center justify-center rounded-[3px] border border-dashed border-muted-foreground/60 text-muted-foreground/70"
          }
        >
          {l.letter}
        </span>
      ))}
    </span>
  );
}
