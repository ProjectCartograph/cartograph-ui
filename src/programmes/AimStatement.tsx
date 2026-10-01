import { copy } from "@/copy";
import { Part, PartText } from "@/projects/StatementEditor";
import type { AimStatement } from "@/sentence";

const pc = copy.programmes;

/**
 * A programme's aim, edited as the parts it is stored in.
 *
 * Why these two parts and not others: a programme is a vehicle for
 * beneficial change, and a benefit is a measurable improvement perceived
 * as an advantage by somebody (TAXONOMY.md). So an aim says what is
 * different and who is then better off — and saying either as *the work
 * this programme does* is the one mistake the field warns about, which is
 * what the first part's hint rules out.
 *
 * An aim quoting a published objective has no second part: it is the
 * change, whole. The two parts are shown under their own labels and never
 * joined into one sentence (TAXONOMY.md D19).
 */
export function AimEditor({
  value,
  onChange,
  "data-cartograph-field": field = "/spec/aim",
}: {
  value: AimStatement | undefined;
  onChange: (next: AimStatement) => void;
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
}) {
  const set = (patch: Partial<AimStatement>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-4" data-cartograph-region={`${field}-parts`}>
      <Part n={1} label={pc.aimChangeLabel} hint={pc.aimChangeHint} examples={pc.aimChangeExamples} exampleKey="aim.change">
        <PartText data-cartograph-field={`${field}/change`} value={value?.change} label={pc.aimChangeLabel} onChange={(v) => set({ change: v })} />
      </Part>
      <Part n={2} label={pc.aimGainLabel} hint={pc.aimGainHint} examples={pc.aimGainExamples} exampleKey="aim.gain">
        <PartText data-cartograph-field={`${field}/gain`} value={value?.gain} label={pc.aimGainLabel} onChange={(v) => set({ gain: v || undefined })} />
      </Part>
    </div>
  );
}
