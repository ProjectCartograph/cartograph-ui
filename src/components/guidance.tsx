import { useExamples } from "@/components/examples";
import { Check, CircleHelp, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { copy } from "@/copy";

const gc = copy.guidance;

/**
 * Two or three entries that would be good answers, one click away. A
 * placeholder can only ever show the shape of an answer; these show what a
 * finished one reads like, so nobody has to invent the standard from
 * nothing. They are read-only on purpose: an example that can be pasted
 * becomes somebody's real definition by accident.
 */
export function Examples({
  items,
  label,
  compact,
}: {
  items: string[];
  label?: string;
  /** The mark alone. For a field that sits in a row with others already
   * offering theirs, where the word would be the same word three times
   * over; the reading stays on the button as its name and its tooltip. */
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  const reading = label ?? gc.examples;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon-sm" : "xs"}
          className="text-muted-foreground"
          aria-label={compact ? reading : undefined}
          data-slot="field-examples"
          title={compact ? reading : undefined}
        >
          <Lightbulb />
          {compact ? null : reading}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <p className="text-xs font-medium">{gc.examplesTitle}</p>
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={i} className="rounded-md bg-muted/50 p-2 text-sm text-pretty">
              {item}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Help for one field, behind a "?". The hint and any examples are one
 * click away rather than always on screen: the page shows labels and
 * answers, and a person who needs help asks for it (Programme Lead,
 * 2026-09-29: "too text-heavy"; Carbon and Polaris put optional guidance
 * in a toggletip the same way). Nothing is rendered when there is nothing
 * to say.
 */
export function Help({
  label,
  hint,
  examples,
  poor,
}: {
  /** The field the help is for, read out as the button's name. */
  label: string;
  hint?: string;
  examples?: string[];
  /** Answers that read plausibly and are wrong, each with why. */
  poor?: { text: string; why: string }[];
}) {
  const hasExamples = !!examples && examples.length > 0;
  const hasPoor = !!poor && poor.length > 0;
  if (!hint && !hasExamples && !hasPoor) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-5 text-muted-foreground hover:text-foreground"
          aria-label={gc.helpFor(label)}
          title={gc.help}
          data-slot="field-help"
        >
          <CircleHelp className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-3 text-sm">
        {hint ? <p className="text-pretty">{hint}</p> : null}
        {hasExamples ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">{gc.examplesTitle}</p>
            <ul className="flex flex-col gap-1.5">
              {examples!.map((item, i) => (
                <li key={i} className="rounded-md bg-muted/50 p-2 text-pretty">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hasPoor ? (
          <div className="flex flex-col gap-1.5" data-slot="poor-examples">
            <p className="text-xs font-medium text-muted-foreground">{gc.poorTitle}</p>
            <ul className="flex flex-col gap-1.5">
              {poor!.map((item, i) => (
                <li key={i} className="rounded-md border border-dashed p-2 text-pretty">
                  <span className="line-through decoration-muted-foreground/60">{item.text}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.why}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * A field's own heading: its label, and a "?" beside it holding the hint
 * and the examples. Nothing else is shown until somebody asks.
 */
export function FieldHeading({
  label,
  hint,
  examples: productExamples,
  exampleKey,
  htmlFor,
  poor,
}: {
  label: string;
  hint?: string;
  examples?: string[];
  poor?: { text: string; why: string }[];
  /** Which field this is, so a vault can supply its own examples for it
   * (TAXONOMY.md D20). */
  exampleKey?: string;
  htmlFor?: string;
}) {
  const examples = useExamples(exampleKey, productExamples);
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Help label={label} hint={hint} examples={examples} poor={poor} />
    </div>
  );
}

export interface QualityMark {
  key: string;
  label: string;
  met: boolean;
}

/**
 * The properties that make an entry strong, lit as each is met. Only
 * properties this can actually tell apart are shown: a mark that lights
 * whatever you type teaches nothing, and a mark for something no program
 * can judge (is this ambitious? does it matter?) belongs in the guidance
 * text, not in a checkbox.
 */
export function QualityMarks({ title, marks }: { title: string; marks: QualityMark[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-slot="quality-marks">
      <span className="text-muted-foreground">{title}</span>
      {marks.map((m) => (
        <span
          key={m.key}
          data-met={m.met}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
            m.met
              ? "bg-success/12 text-success"
              : "text-muted-foreground ring-1 ring-border"
          }`}
        >
          {m.met ? <Check className="size-3" /> : null}
          {m.label}
        </span>
      ))}
    </div>
  );
}
