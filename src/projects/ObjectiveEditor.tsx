import { useExamples } from "@/components/examples";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasDigit } from "@/components/guide";
import { Help, QualityMarks, type QualityMark } from "@/components/guidance";
import { copy } from "@/copy";

const gc = copy.projects.goals;

/** The objective is stored as one sentence. The editor works in two parts
 * because that is how the sentence is built: the change, then how. A
 * stored sentence splits back on its first " by ", so a definition written
 * elsewhere (or in YAML) round-trips through this editor unchanged. */
export function splitObjective(objective: string, meansWord = "by"): { outcome: string; means: string } {
  if (!meansWord) return { outcome: objective, means: "" };
  const at = objective.toLowerCase().indexOf(` ${meansWord.toLowerCase()} `);
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
export function splitVerb(outcome: string, verbs: string[]): { verb: string; rest: string } {
  const text = outcome.trimStart();
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(text);
  const word = (m?.[1] ?? "").toLowerCase();
  if (m && verbs.includes(word)) return { verb: word, rest: m[2] ?? "" };
  return { verb: "", rest: text };
}

export function joinVerb(verb: string, rest: string): string {
  const v = verb ? verb[0].toUpperCase() + verb.slice(1) : "";
  const r = rest.trimStart();
  if (!v) return r;
  return r ? `${v} ${r}` : v;
}

/** The means is stored with its word ("by"); the field shows the word as
 * a fixed prefix so it is never typed twice. */
function stripWord(means: string, word: string): string {
  const text = means.trimStart();
  return text.toLowerCase().startsWith(word.toLowerCase() + " ") ? text.slice(word.length + 1) : text;
}

/**
 * The objective, as three parts: an opening word picked from those the
 * guide offers in this language, what it changes, and by what means (the
 * guide's word for it). It is stored as one sentence because the contract
 * holds one, but no preview assembles it while typing; the parts are the
 * answer (TAXONOMY.md D19). Where the guide offers no words, the parts it
 * would split are one line. Whether it names a change or a task is a
 * judgement for the guidance, never a mark; the marks are what the engine
 * itself decides.
 */
export function ObjectiveEditor({
  objective,
  alignedGoals,
  onChange,
  verbs = [],
  meansWord = "",
  "data-cartograph-field": field,
}: {
  /** The opening words the guide offers, in this language. */
  verbs?: string[];
  /** The guide's word introducing the means ("by"); none, no means part. */
  meansWord?: string;
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
    const { outcome, means } = splitObjective(text, meansWord);
    return { ...splitVerb(outcome, verbs), means };
  };
  const [parts, setParts] = useState(() => seed(objective));
  const emitted = useRef(objective);

  useEffect(() => {
    if (objective === emitted.current) return;
    emitted.current = objective;
    setParts(seed(objective));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objective]);
  // The words arrive with the guide: the sentence is split again once
  // they do.
  const wordsKey = [meansWord, ...verbs].join("\n");
  useEffect(() => {
    setParts(seed(emitted.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordsKey]);

  function edit(next: { verb: string; rest: string; means: string }) {
    setParts(next);
    const joined = joinObjective(joinVerb(next.verb, next.rest), next.means);
    emitted.current = joined;
    onChange(joined);
  }

  const { verb, rest, means } = parts;
  const examples = useExamples("objective", gc.objectiveExamples);

  const marks: QualityMark[] = [
    { key: "aligned", label: gc.objectiveQuality.aligned, met: alignedGoals > 0 },
    // The kind rule: an objective carrying a number is a key result
    // wearing the wrong hat, and the server refuses it.
    { key: "qualitative", label: gc.objectiveQuality.qualitative, met: !hasDigit(objective) },
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
          {verbs.length > 0 ? (
            <Select value={verb || undefined} onValueChange={(v) => edit({ verb: v, rest, means })}>
              <SelectTrigger className="w-40" aria-label={gc.objectiveVerbLabel}>
                <SelectValue placeholder={gc.objectiveVerbPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {verbs.map((v) => (
                  <SelectItem key={v} value={v}>
                    {joinVerb(v, "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Input
            value={rest}
            onChange={(e) => edit({ verb, rest: e.target.value.slice(0, 110), means })}
            aria-label={gc.objectiveStepOutcome}
            maxLength={120}
            className="min-w-48 flex-1"
          />
        </div>
      </Step>

      {meansWord ? (
        <Step n={2} title={gc.objectiveStepMeans}>
          <InputGroup>
            <InputGroupAddon>{meansWord}</InputGroupAddon>
            <InputGroupInput
              value={stripWord(means, meansWord)}
              onChange={(e) => {
                const text = e.target.value.slice(0, 117);
                edit({ verb, rest, means: text.trim() ? `${meansWord} ${text}` : "" });
              }}
              aria-label={gc.objectiveStepMeans}
            />
          </InputGroup>
        </Step>
      ) : null}

      <QualityMarks title={gc.objectiveQualityTitle} marks={marks} />
    </div>
  );
}
