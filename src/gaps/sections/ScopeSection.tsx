import { useState } from "react";

import { KindExamples } from "@/components/KindExamples";
import { FieldHeading } from "@/components/guidance";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { SheetAddDialog } from "@/surfaces/sheet/InlineSheetAdd";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { GapSpec } from "../types";

const gc = copy.gaps;

/**
 * The slices this shortfall was observed in.
 *
 * Not the groups a problem names: those say who a piece of work is
 * answering for, these say what the evidence covers. Enumerating them is
 * the whole point — it is what lets work address part of a gap and be
 * recorded as addressing part of it.
 */
export function ScopeSection() {
  useSectionAutosave();
  const store = useDefinitionStore<GapSpec>();
  const { data } = useReferenceOptions("Segment");
  const [adding, setAdding] = useState(false);

  return (
    <div data-cartograph-region="gap-scope" className="flex max-w-3xl flex-col gap-2">
      <FieldHeading label={gc.segmentsLabel} hint={gc.segmentsHint} />
      <KindExamples kind="Segment" compact />
      <ComboboxMultiple
        data-cartograph-field="/spec/segments"
        options={data?.options ?? []}
        value={store.spec.segments ?? []}
        onValueChange={(next) =>
          store.updateSpec((s) => ({ ...s, segments: next.length > 0 ? next : undefined }))
        }
        placeholder={gc.segmentsPlaceholder}
        emptyText={gc.segmentsNone}
        removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
        aria-label={gc.segmentsLabel}
        onAdd={() => setAdding(true)}
        addLabel={gc.segmentsAdd}
      />
      <SheetAddDialog
        kind="Segment"
        open={adding}
        onOpenChange={setAdding}
        onAdded={(id) =>
          store.updateSpec((s) => ({ ...s, segments: [...(s.segments ?? []), id] }))
        }
      />
    </div>
  );
}
