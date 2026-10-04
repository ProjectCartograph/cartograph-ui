import { FieldHeading } from "@/components/guidance";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { GapSpec } from "../types";

const gc = copy.gaps;

/** How we know: where it is written down, in its own words, and where it
 * can be watched. Provenance rather than a link: a citation names a
 * document, which Cartograph does not hold. */
export function EvidenceSection() {
  useSectionAutosave();
  const store = useDefinitionStore<GapSpec>();
  const sources = useReferenceOptions("DataSource");
  // A draft from before 2.7.0 may hold one, as measuredBy.
  const dataSources = store.spec.dataSources ?? (store.spec.measuredBy ? [store.spec.measuredBy] : []);
  return (
    <div data-cartograph-region="gap-evidence" className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.sourceLabel} hint={gc.sourceHint} htmlFor="gap-source" />
        <Input
          data-cartograph-field="/spec/source"
          id="gap-source"
          maxLength={240}
          value={store.spec.source ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, source: e.target.value || undefined }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.quoteLabel} hint={gc.quoteHint} htmlFor="gap-quote" />
        <Textarea
          data-cartograph-field="/spec/statement"
          id="gap-quote"
          rows={3}
          maxLength={400}
          value={store.spec.statement ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, statement: e.target.value || undefined }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.measuredByLabel} hint={gc.measuredByHint} />
        <ComboboxMultiple
          data-cartograph-field="/spec/dataSources"
          options={sources.data?.options ?? []}
          value={dataSources}
          onValueChange={(next) =>
            store.updateSpec((s) => ({ ...s, measuredBy: undefined, dataSources: next.length > 0 ? next : undefined }))
          }
          placeholder={gc.measuredByPlaceholder}
          emptyText={gc.measuredByNone}
          removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
          aria-label={gc.measuredByLabel}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={gc.noteLabel} htmlFor="gap-note" />
        <Textarea
          data-cartograph-field="/spec/note"
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
