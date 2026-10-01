import { Textarea } from "@/components/ui/textarea";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import type { ChangeStatement, ProblemStatement } from "@/sentence";

const ac = copy.projects.aim;

/**
 * The problem and the change, edited as the parts they are stored in.
 *
 * The manifest holds `{situation, cause}` and `{what, gain}`, and each part
 * is written as a sentence of its own. They are shown the same way
 * everywhere, each under its own label, and never glued into one sentence:
 * a tool cannot promise the grammar of a sentence it assembles, and the
 * preview that tried to was the part people found most confusing
 * (TAXONOMY.md D19, LSS_REVIEW.md).
 *
 * Who feels it is picked as a list on the card above, not typed here.
 */

/** One numbered part: its label, its one-sentence hint, its examples. */
export function Part({
  n,
  label,
  hint,
  examples,
  exampleKey,
  children,
}: {
  n: number;
  label: string;
  hint?: string;
  examples?: string[];
  exampleKey?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <FieldHeading label={label} hint={hint} examples={examples} exampleKey={exampleKey} />
        {children}
      </div>
    </div>
  );
}

/** A part's text box: two lines, because a part is a sentence. */
export function PartText({
  value,
  label,
  onChange,
  "data-cartograph-field": field,
}: {
  value: string | undefined;
  label: string;
  onChange: (next: string) => void;
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
}) {
  return (
    <Textarea
      data-cartograph-field={field}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value.slice(0, 600))}
      aria-label={label}
      rows={2}
      className="min-h-0 resize-none"
    />
  );
}

export function ProblemEditor({
  value,
  onChange,
  "data-cartograph-field": field,
}: {
  /** The statement's own pointer; each part is named under it. */
  "data-cartograph-field"?: string;
  value: ProblemStatement | undefined;
  /** Kept for callers; the groups are shown on the card, not here. */
  groups?: string[];
  onChange: (next: ProblemStatement) => void;
}) {
  const set = (patch: Partial<ProblemStatement>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Part n={1} label={ac.situationLabel} hint={ac.situationHint} examples={ac.situationExamples} exampleKey="problem.situation">
        <PartText data-cartograph-field={field && `${field}/situation`} value={value?.situation} label={ac.situationLabel} onChange={(v) => set({ situation: v })} />
      </Part>
      <Part n={2} label={ac.causeLabel} hint={ac.causeHint} examples={ac.causeExamples} exampleKey="problem.cause">
        <PartText data-cartograph-field={field && `${field}/cause`} value={value?.cause} label={ac.causeLabel} onChange={(v) => set({ cause: v || undefined })} />
      </Part>
    </div>
  );
}

export function ChangeEditor({
  value,
  onChange,
  "data-cartograph-field": field,
}: {
  /** The statement's own pointer; each part is named under it. */
  "data-cartograph-field"?: string;
  value: ChangeStatement | undefined;
  groups?: string[];
  onChange: (next: ChangeStatement) => void;
}) {
  const set = (patch: Partial<ChangeStatement>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Part n={1} label={ac.changeWhatLabel} hint={ac.changeWhatHint} examples={ac.changeWhatExamples} exampleKey="change.what">
        <PartText data-cartograph-field={field && `${field}/what`} value={value?.what} label={ac.changeWhatLabel} onChange={(v) => set({ what: v })} />
      </Part>
      <Part n={2} label={ac.changeGainLabel} hint={ac.changeGainHint} examples={ac.changeGainExamples} exampleKey="change.gain">
        <PartText data-cartograph-field={field && `${field}/gain`} value={value?.gain} label={ac.changeGainLabel} onChange={(v) => set({ gain: v || undefined })} />
      </Part>
    </div>
  );
}
