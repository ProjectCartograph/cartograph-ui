import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QualityMarks, type QualityMark } from "@/components/guidance";
import { copy } from "@/copy";
import { hasDigit } from "@/components/guide";
import { joinVerb } from "@/projects/ObjectiveEditor";

const ac = copy.goals.editor.aim;

/** The statement split into an offered opening word and the rest; no
 * word is split off when verbs is empty or the statement opens with
 * another. */
export function splitAim(text: string, verbs: string[]): { verb: string; rest: string } {
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(text.trimStart());
  const word = (m?.[1] ?? "").toLowerCase();
  if (m && verbs.includes(word)) return { verb: word, rest: m[2] ?? "" };
  return { verb: "", rest: text.trimStart() };
}

/**
 * The aim's statement. A goal or objective is built from parts (TAXONOMY.md
 * D19): an opening word picked from the words the guide offers in this
 * language, and what it changes; an outcome is one line describing a
 * state. Where the guide offers no words, every level is one line. Whether
 * a statement is an action or a state is a judgement no program can make
 * honestly in every language, so it is guidance (the field's "?"), never a
 * mark; the one mark is the engine's own rule, that numbers belong in the
 * measures.
 */
export function AimEditor({
  level,
  value,
  onChange,
  maxLength,
  verbs = [],
  "data-cartograph-field": field,
}: {
  level: string;
  /** The opening words the guide offers for an aim, in this language. */
  verbs?: string[];
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  /** The manifest field the statement is, by JSON pointer. */
  "data-cartograph-field"?: string;
}) {
  const [parts, setParts] = useState(() => splitAim(value, verbs));
  const emitted = useRef(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setParts(splitAim(value, verbs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  // The words arrive with the guide: the statement is split again once
  // they do.
  const verbKey = verbs.join("\n");
  useEffect(() => {
    setParts(splitAim(emitted.current, verbKey ? verbKey.split("\n") : []));
  }, [verbKey]);

  const marks: QualityMark[] = [{ key: "numbers", label: ac.marks.noNumbers, met: value.trim() !== "" && !hasDigit(value) }];
  if (level === "outcome" || verbs.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Input
          id="goal-objective"
          data-cartograph-field={field}
          aria-label={ac.stateLabel}
          value={value}
          maxLength={maxLength}
          onChange={(e) => {
            emitted.current = e.target.value;
            onChange(e.target.value);
          }}
          className="text-base"
        />
        <QualityMarks title={ac.marksTitle} marks={marks} />
      </div>
    );
  }

  function edit(next: { verb: string; rest: string }) {
    setParts(next);
    const joined = joinVerb(next.verb, next.rest);
    emitted.current = joined;
    onChange(joined.slice(0, maxLength));
  }
  return (
    <div className="flex flex-col gap-2">
      {/* The word and the rest are one field between them, so the row is
          what names it: neither box alone holds the field's text. */}
      <div className="flex gap-2" data-cartograph-field={field}>
        <Select value={parts.verb} onValueChange={(v) => edit({ ...parts, verb: v })}>
          <SelectTrigger aria-label={ac.verbLabel} className="w-40 shrink-0 capitalize">
            <SelectValue placeholder={ac.verbPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {verbs.map((v) => (
              <SelectItem key={v} value={v} className="capitalize">
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id="goal-objective"
          aria-label={ac.restLabel}
          value={parts.rest}
          maxLength={maxLength}
          onChange={(e) => edit({ ...parts, rest: e.target.value })}
          className="text-base"
        />
      </div>
      <QualityMarks title={ac.marksTitle} marks={marks} />
    </div>
  );
}
