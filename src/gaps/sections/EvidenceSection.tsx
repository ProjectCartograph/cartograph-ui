import { FieldHeading } from "@/components/guidance";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import type { GapSpec } from "../types";

const gc = copy.gaps;

/** How we know: where it is written down, in its own words, and where it
 * can be watched. Provenance rather than a link: a citation names a
 * document, which Cartograph does not hold. */
export function EvidenceSection() {
  useSectionAutosave();
  const store = useDefinitionStore<GapSpec>();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.sourceLabel} hint={gc.sourceHint} htmlFor="gap-source" />
        <Input
          id="gap-source"
          maxLength={240}
          value={store.spec.source ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, source: e.target.value || undefined }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.quoteLabel} hint={gc.quoteHint} htmlFor="gap-quote" />
        <Textarea
          id="gap-quote"
          rows={3}
          maxLength={400}
          value={store.spec.statement ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, statement: e.target.value || undefined }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.measuredByLabel} hint={gc.measuredByHint} />
        <ReferencePicker
          refKind="DataSource"
          value={store.spec.measuredBy}
          onChange={(v) => store.updateSpec((s) => ({ ...s, measuredBy: v || undefined }))}
          placeholder={gc.measuredByPlaceholder}
          label={gc.measuredByLabel}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.noteLabel} htmlFor="gap-note" />
        <Textarea
          id="gap-note"
          rows={2}
          maxLength={400}
          value={store.spec.note ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, note: e.target.value || undefined }))}
        />
      </div>
    </div>
  );
}
