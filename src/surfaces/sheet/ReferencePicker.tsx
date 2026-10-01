import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { ReferenceField } from "./ReferenceField";
import { KPIAddDialog } from "@/kpis/KPIAddDialog";
import { SheetAddDialog } from "./InlineSheetAdd";
import { isSheetKind, type SheetKind } from "./schema";
import { useReferenceOptions } from "./useReferenceOptions";

/**
 * A reference picker that can also create what it is missing: the stock
 * combobox, plus a button that opens the directory's own Add dialog and
 * selects the new entry when it saves. Used everywhere inside the project
 * flow, so defining a project never has to be abandoned to go and add a
 * data source first.
 */
export function ReferencePicker({
  refKind,
  value,
  onChange,
  placeholder,
  label,
  addLabel,
  className,
}: {
  refKind: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
  /** The field's own heading, read out in place of the placeholder. */
  label?: string;
  addLabel?: string;
  className?: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  // A measure is not a sheet kind — its baseline and target are objects
  // where a sheet's cells hold values — so it brings its own dialog
  // rather than going without the add every other register has.
  const isKPI = refKind === "KPI";
  const canAdd = isSheetKind(refKind) || isKPI;
  const kindLabel = copy.sheets.kindsSingular[refKind] ?? refKind;

  // An empty directory already renders its own "Add one" in place of the
  // combobox; a second add button beside it would say the same thing twice.
  const { data, isLoading } = useReferenceOptions(refKind);
  const empty = !isLoading && (data?.options.length ?? 0) === 0;

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <div className="min-w-0 flex-1">
        <ReferenceField
          refKind={refKind}
          value={value}
          onChange={(next) => onChange(next as string | undefined)}
          placeholder={placeholder}
          label={label}
          onRequestAdd={canAdd ? () => setAddOpen(true) : undefined}
        />
      </div>
      {canAdd ? (
        <>
          {empty ? null : (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="shrink-0"
            aria-label={addLabel ?? `${copy.sheets.add} ${kindLabel.toLowerCase()}`}
            title={addLabel ?? `${copy.sheets.add} ${kindLabel.toLowerCase()}`}
            onClick={() => setAddOpen(true)}
          >
            <Plus />
          </Button>
          )}
          {isKPI ? (
            <KPIAddDialog open={addOpen} onOpenChange={setAddOpen} onAdded={(id) => onChange(id)} />
          ) : (
            <SheetAddDialog
              kind={refKind as SheetKind}
              open={addOpen}
              onOpenChange={setAddOpen}
              onAdded={(id) => onChange(id)}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
