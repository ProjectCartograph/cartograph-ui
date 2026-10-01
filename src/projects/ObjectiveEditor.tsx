import { useExamples } from "@/components/examples";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Help, QualityMarks, type QualityMark } from "@/components/guidance";
import { copy } from "@/copy";

const gc = copy.projects.goals;

/** The verbs an objective opens with when it names a change rather than a
 * task. Picked from a list since 2026-09-29, which people asked for over
 * the sentence builder (LSS_REVIEW.md, D19). An objective written
 * elsewhere that starts with another word is kept whole, with no verb
 * picked, so nothing typed is rewritten. */
export const OUTCOME_VERBS = [
  "improve",
  "increase",
  "raise",
  "grow",
  "strengthen",
  "reduce",
  "cut",
  "shorten",
  "remove",
  "eliminate",
  "simplify",
  "make",
  "give",
  "enable",
  "establish",
  "restore",
  "protect",
  "open",
  "shift",
  "move",
  "bring",
  "turn",
  "close",
  "end",
  "speed",
  "lower",
  "widen",
  "deepen",
  "secure",
  "standardise",
  "standardize",
];

/** The objective is stored as one sentence. The editor works in two parts
 * because that is how the sentence is built: the change, then how. A
 * stored sentence splits back on its first " by ", so a definition written
 * elsewhere (or in YAML) round-trips through this editor unchanged. */
export function splitObjective(objective: string): { outcome: string; means: string } {
  const at = objective.toLowerCase().indexOf(" by ");
  if (at === -1) return { outcome: objective, means: "" };
  return { outcome: objective.slice(0, at), means: objective.slice(at + 1) };
}

export function joinObjective(outcome: string, means: string): string {
  const left = outcome.trim();
  const right = means.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

/** One numbered part of the sentence, its guidance, and its examples. */
function Step({
  n,
  title,
  hint,
  examples,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  examples?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
          {n}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">{title}</span>
          <Help label={title} hint={hint} examples={examples} />
        </div>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}

/** The opening verb and the rest of the outcome. */
// Neither function trims the end: a space typed between two words has to
// survive the round trip through the stored sentence, or it is eaten.
export function splitVerb(outcome: string): { verb: string; rest: string } {
  const text = outcome.trimStart();
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(text);
  const word = (m?.[1] ?? "").toLowerCase();
  if (m && OUTCOME_VERBS.includes(word)) return { verb: word, rest: m[2] ?? "" };
  return { verb: "", rest: text };
}

export function joinVerb(verb: string, rest: string): string {
  const v = verb ? verb[0].toUpperCase() + verb.slice(1) : "";
  const r = rest.trimStart();
  if (!v) return r;
  return r ? `${v} ${r}` : v;
}

/** The means is stored with its "by"; the field shows the word as a fixed
 * prefix so it is never typed twice. */
function stripBy(means: string): string {
  return means.trimStart().replace(/^by\s+/i, "");
}

/**
 * The objective, as three parts: a verb picked from a list, what it
 * changes, and by what means. It is stored as one sentence because the
 * contract holds one, but no preview assembles it while typing; the parts
 * are the answer (TAXONOMY.md D19). The marks light as the properties that
 * make an objective strong are met. An objective is
 * qualitative and aspirational, so the marks only cover what a program can
 * honestly tell apart; the two that matter most and cannot be checked
 * (ambitious, significant) are said in words underneath.
 */
export function ObjectiveEditor({
  objective,
  alignedGoals,
  onChange,
  "data-cartograph-field": field,
}: {
  /** The manifest field this edits, by JSON pointer. The sentence is
   * typed in two parts, so the field is named on the editor as a whole:
   * neither box holds its text. */
  "data-cartograph-field"?: string;
  objective: string;
  /** How many goals this project serves, for the "Aligned" mark. */
  alignedGoals: number;
  onChange: (next: string) => void;
}) {
  // The two parts are held here, not re-derived from the joined sentence
  // on every keystroke: the split point is the first " by ", so a means
  // beginning with "by" moves it, and re-splitting mid-word tore typed
  // text apart a character at a time. The sentence is still the only
  // thing stored; these are re-seeded from it when it changes from
  // outside (a different project loaded, or an edit made in the YAML).
  // The verb is held apart from the rest for the same reason: a stored
  // sentence is split once, and typing a listed verb into the text box
  // must not make it jump into the dropdown mid-word.
  const seed = (text: string) => {
    const { outcome, means } = splitObjective(text);
    return { ...splitVerb(outcome), means };
  };
  const [parts, setParts] = useState(() => seed(objective));
  const emitted = useRef(objective);

  useEffect(() => {
    if (objective === emitted.current) return;
    emitted.current = objective;
    setParts(seed(objective));
  }, [objective]);

  function edit(next: { verb: string; rest: string; means: string }) {
    setParts(next);
    const joined = joinObjective(joinVerb(next.verb, next.rest), next.means);
    emitted.current = joined;
    onChange(joined);
  }

  const { verb, rest, means } = parts;
  const examples = useExamples("objective", gc.objectiveExamples);
  const outcome = joinVerb(verb, rest);

  const firstWord = outcome.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const marks: QualityMark[] = [
    { key: "aligned", label: gc.objectiveQuality.aligned, met: alignedGoals > 0 },
    {
      key: "actionOriented",
      label: gc.objectiveQuality.actionOriented,
      met: OUTCOME_VERBS.includes(firstWord),
    },
    { key: "concrete", label: gc.objectiveQuality.concrete, met: means.trim().length >= 4 },
    // The kind rule: an objective carrying a number is a key result
    // wearing the wrong hat, and the server refuses it.
    { key: "qualitative", label: gc.objectiveQuality.qualitative, met: !/\d/.test(objective) },
  ];


  return (
    <div className="flex flex-col gap-4" data-cartograph-field={field}>
      <Step
        n={1}
        title={gc.objectiveStepOutcome}
        hint={gc.objectiveStepOutcomeHint}
        examples={examples}
      >
        <div className="flex flex-wrap gap-2">
          <Select
            value={verb || undefined}
            onValueChange={(v) => edit({ verb: v, rest, means })}
          >
            <SelectTrigger className="w-40" aria-label={gc.objectiveVerbLabel}>
              <SelectValue placeholder={gc.objectiveVerbPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_VERBS.map((v) => (
                <SelectItem key={v} value={v}>
                  {joinVerb(v, "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={rest}
            onChange={(e) => edit({ verb, rest: e.target.value.slice(0, 110), means })}
            aria-label={gc.objectiveStepOutcome}
            maxLength={120}
            className="min-w-48 flex-1"
          />
        </div>
      </Step>

      <Step n={2} title={gc.objectiveStepMeans}>
        <InputGroup>
          <InputGroupAddon>{gc.objectiveBy}</InputGroupAddon>
          <InputGroupInput
            value={stripBy(means)}
            onChange={(e) => {
              const text = e.target.value.slice(0, 117);
              edit({ verb, rest, means: text.trim() ? `${gc.objectiveBy} ${text}` : "" });
            }}
            aria-label={gc.objectiveStepMeans}
          />
        </InputGroup>
      </Step>

      <QualityMarks title={gc.objectiveQualityTitle} marks={marks} />
    </div>
  );
}
