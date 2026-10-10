import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { parseSpecFields, type SheetKind } from "./schema";
import { SheetForm } from "./SheetForm";
import { GapAddDialog } from "@/gaps/GapAddDialog";

/**
 * Adds one entry to a directory without leaving the screen that needed it.
 * The project flow never sends a person to the Sheets pages mid-definition:
 * a missing data source, team or resource is added here, in a dialog, and
 * the picker that asked for it selects what was just created.
 */
export function SheetAddDialog({
  kind,
  open,
  onOpenChange,
  onAdded,
  minimal,
  preset,
}: {
  kind: SheetKind | string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (id: string, name: string) => void;
  /** Only what the record requires (TAXONOMY.md D34). */
  minimal?: { reason: string };
  preset?: Record<string, unknown>;
}) {
  const client = useClient();
  const schemaQuery = useQuery({
    queryKey: ["schema", kind],
    queryFn: () => client.schema(kind),
    enabled: open,
  });
  const fields = useMemo(() => parseSpecFields(schemaQuery.data), [schemaQuery.data]);

  // A gap is recorded on its own compact screen, its shortfall drawn
  // from now to where it should be (#31).
  if (kind === "Gap" && !minimal) return <GapAddDialog open={open} onOpenChange={onOpenChange} onAdded={onAdded} preset={preset} />;
  return (
    <SheetForm
      kind={kind}
      kindLabel={copy.sheets.kindsSingular[kind] ?? kind}
      fields={fields}
      open={open}
      onOpenChange={onOpenChange}
      onSaved={onAdded}
      minimal={minimal}
      preset={preset}
    />
  );
}

/** The dialog above, with its own button. */
export function InlineSheetAdd({
  kind,
  label,
  variant = "outline",
  size = "sm",
  onAdded,
}: {
  kind: SheetKind;
  label?: string;
  variant?: "outline" | "ghost" | "link";
  size?: "sm" | "xs" | "default";
  onAdded?: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const kindLabel = copy.sheets.kindsSingular[kind] ?? kind;

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        <Plus />
        {label ?? `${copy.sheets.add} ${kindLabel.toLowerCase()}`}
      </Button>
      <SheetAddDialog kind={kind} open={open} onOpenChange={setOpen} onAdded={onAdded} />
    </>
  );
}
