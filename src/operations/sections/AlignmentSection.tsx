import { ComboboxMultiple } from "@/components/ui/combobox";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import type { OperationSpec } from "../types";

const oc = copy.operations;

/**
 * Which programmes this operation is part of.
 *
 * Business-as-usual sits inside a programme's boundary in both programme
 * standards (TAXONOMY.md D2), and an operation could not say so until
 * 2026-09-28 — so a programme answered "what is in this programme?" with
 * only its projects. Declared here, read back on the programme, the same
 * way a project declares its own.
 */
export function AlignmentSection() {
  useSectionAutosave();
  const store = useDefinitionStore<OperationSpec>();
  const { data: programmes } = useReferenceOptions("Programme");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <FieldHeading label={oc.programmesLabel} hint={oc.programmesHint} />
        <ComboboxMultiple
          options={programmes?.options ?? []}
          value={store.spec.programmes ?? []}
          onValueChange={(next) =>
            store.updateSpec((s) => ({ ...s, programmes: next.length > 0 ? next : undefined }))
          }
          emptyText={copy.sheets.dialog.noMatches}
          removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
          aria-label={oc.programmesLabel}
        />
      </div>
    </div>
  );
}
