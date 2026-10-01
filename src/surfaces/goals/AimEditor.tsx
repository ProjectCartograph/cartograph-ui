import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QualityMarks, type QualityMark } from "@/components/guidance";
import { copy } from "@/copy";
import { OUTCOME_VERBS, joinVerb } from "@/projects/ObjectiveEditor";

const ac = copy.goals.editor.aim;

/** The action words an aim opens with: the project list plus the words
 * strategic plans use for broad aims. */
export const AIM_VERBS = Array.from(
  new Set([
    ...OUTCOME_VERBS,
    "ensure", "enhance", "expand", "empower", "transform", "modernize", "modernise", "institutionalize",
    "institutionalise", "clarify", "promote", "align", "use", "build", "deliver", "support", "keep", "hold", "cut",
  ]),
).sort();

export function splitAim(text: string): { verb: string; rest: string } {
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(text.trimStart());
  const word = (m?.[1] ?? "").toLowerCase();
  if (m && AIM_VERBS.includes(word)) return { verb: word, rest: m[2] ?? "" };
  return { verb: "", rest: text.trimStart() };
}

const hasDigit = (s: string) => /\d/.test(s);

/**
 * The aim's statement, built from parts rather than typed as a sentence
 * (TAXONOMY.md D19). A goal or objective is an action word picked from a
 * list and what it changes; an outcome is one short line describing a
 * state. Marks light as the statement takes a sound shape, so a new user
 * sees what good looks like while writing.
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
  const [parts, setParts] = useState(() => splitAim(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setParts(splitAim(value));
  }, [value]);

  const short = value.trim().length > 0 && value.trim().length <= 90;
  if (level === "outcome") {
    const first = value.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const marks: QualityMark[] = [
      { key: "state", label: ac.marks.state, met: value.trim() !== "" && !AIM_VERBS.includes(first) },
      { key: "numbers", label: ac.marks.noNumbers, met: value.trim() !== "" && !hasDigit(value) },
      { key: "short", label: ac.marks.short, met: short },
    ];
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
  const marks: QualityMark[] = [
    { key: "action", label: ac.marks.action, met: parts.verb !== "" },
    { key: "numbers", label: ac.marks.noNumbers, met: parts.rest.trim() !== "" && !hasDigit(value) },
    { key: "short", label: ac.marks.short, met: short },
  ];
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
            {AIM_VERBS.map((v) => (
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
