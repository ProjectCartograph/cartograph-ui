import { Link } from "@tanstack/react-router";

import { copy } from "@/copy";
import { isSheetKind } from "./schema";

// Kinds referenced by a picker that are not among the seven sheets (no
// dedicated "add one" link exists for these; the directory itself lives on
// another screen, e.g. Goals home).
const EXTRA_LABELS: Record<string, string> = {
  Goal: "goals",
  Operation: "operations",
  Programme: "programmes",
};

function directoryLabel(kind: string): string {
  const plural = copy.sheets.kinds[kind] ?? EXTRA_LABELS[kind] ?? kind;
  return plural.toLowerCase();
}

/**
 * The stock reply for a picker whose directory has no entries yet: never a
 * required Select or Combobox with an empty list, always this line (with a
 * link to the sheet where the entry is added, when that kind is one of the
 * seven sheets). Used by every reference picker across the app once its
 * options list has loaded and is confirmed empty.
 */
export function DirectoryEmptyHint({
  kind,
  onRequestAdd,
}: {
  kind: string;
  /** Given by a caller that can add the entry without navigating away (the
   * project flow); the link to the sheet is then never shown. */
  onRequestAdd?: () => void;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {copy.common.directoryEmpty(directoryLabel(kind))}{" "}
      {onRequestAdd ? (
        <button type="button" onClick={onRequestAdd} className="underline underline-offset-2">
          {copy.common.directoryEmptyLink}
        </button>
      ) : isSheetKind(kind) ? (
        <Link to="/sheets/$kind" params={{ kind }} className="underline underline-offset-2">
          {copy.common.directoryEmptyLink}
        </Link>
      ) : null}
    </p>
  );
}
