import { Combobox, ComboboxMultiple } from "@/components/ui/combobox";
import { copy } from "@/copy";
import { DirectoryEmptyHint } from "./DirectoryEmpty";
import { useReferenceOptions } from "./useReferenceOptions";

/**
 * The reference form field: a searchable picker fed by the referenced
 * kind's current list. In multiple mode it renders the selection as chips,
 * for array-of-reference properties.
 */
export function ReferenceField({
  refKind,
  multiple,
  value,
  onChange,
  placeholder,
  label,
  onRequestAdd,
}: {
  refKind: string;
  multiple?: boolean;
  value: string | string[] | undefined;
  onChange: (next: string | string[] | undefined) => void;
  placeholder?: string;
  /** What to read the field out as. The placeholder is the fallback, but
   * it goes away as soon as something is picked, so a field with a
   * heading of its own should pass that heading here. */
  label?: string;
  /** When the directory is empty, offer this instead of a link away from
   * the current screen (the project flow adds the missing entry inline). */
  onRequestAdd?: () => void;
}) {
  const { data, isLoading } = useReferenceOptions(refKind);
  const options = data?.options ?? [];
  const empty = !isLoading && options.length === 0;

  const inputPlaceholder = isLoading ? copy.sheets.dialog.loadingOptions : placeholder;

  // No required or optional picker is ever shown with zero options: once
  // the directory is confirmed empty, the stock empty message (with a link
  // to where the entry is added) replaces the picker entirely; the form
  // itself still saves without a value here whenever the schema does not
  // require it (required's own validation is unchanged, and reports on the
  // field exactly as it would for any other missing required value).
  if (empty) {
    return <DirectoryEmptyHint kind={refKind} onRequestAdd={onRequestAdd} />;
  }

  if (multiple) {
    return (
      <ComboboxMultiple
        options={options}
        value={Array.isArray(value) ? value : []}
        onValueChange={(next) => onChange(next)}
        placeholder={inputPlaceholder}
        emptyText={copy.sheets.dialog.noMatches}
        removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
        aria-label={label ?? placeholder}
      />
    );
  }

  return (
    <Combobox
      options={options}
      value={typeof value === "string" && value ? value : undefined}
      onValueChange={(next) => onChange(next)}
      placeholder={inputPlaceholder}
      // The search box needs its own words. It fell back to the trigger's
      // placeholder, which is unset once something is picked -- so the
      // commonest case, reopening a field that already holds a value, gave
      // a bare box with a magnifier and nothing else.
      searchPlaceholder={copy.sheets.searchPlaceholder}
      emptyText={copy.sheets.dialog.noMatches}
      clearLabel={copy.common.clear}
      aria-label={label ?? placeholder}
    />
  );
}
