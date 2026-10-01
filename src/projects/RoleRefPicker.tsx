import { useMemo } from "react";
import { Plus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/copy";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { ProjectRole, Ref } from "./types";

/** The sentinel for "name a role that does not exist yet"; never stored. */
export const ADD_ROLE = "__add_role__";

/** One role as a picker offers it: the id a reference points at, and the
 * title to show. A role with no title of its own shows its position. */
export interface RoleOption {
  id: string;
  label: string;
}

/**
 * Every role this project names, as references can point at them.
 *
 * A role with no id yet is skipped rather than offered: pointing at one
 * would produce a reference that resolves to nothing. Ids are assigned on
 * write and back-filled on read, so this is only ever empty for a role
 * added in a session that has not saved.
 *
 * The label is the catalogue entry's own name, looked up rather than
 * copied, so renaming a Resource renames it everywhere it is mentioned.
 * A row that names no catalogue entry yet reads as its position, which is
 * the only thing it has said so far.
 */
export function roleOptions(
  resources: ProjectRole[],
  resourceName?: (id: string) => string | undefined,
): RoleOption[] {
  const out: RoleOption[] = [];
  for (const r of resources) {
    if (!r.id) continue;
    const named = r.resource ? resourceName?.(r.resource) : undefined;
    const label = (named ?? "").trim() || (copy.projects.resources.roleKind[r.role] ?? r.role);
    out.push({ id: r.id, label });
  }
  return out;
}

/**
 * The catalogue lookup roleOptions wants, from the Resource directory.
 * Its own hook so the three places that list roles read one cache entry.
 */
export function useResourceNames(): (id: string) => string | undefined {
  const { data } = useReferenceOptions("Resource");
  const byID = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of data?.options ?? []) m.set(o.value, o.label);
    return m;
  }, [data]);
  return (id: string) => byID.get(id);
}

/** What a reference should read as, given the roles this project has. A
 * reference to a role shows the role's current title, which is the whole
 * point: the title lives in one place and every mention follows it. */
export function roleRefLabel(value: Ref | undefined, options: RoleOption[]): string {
  if (!value) return "";
  if (value.external) return value.external;
  return options.find((o) => o.id === value.id)?.label ?? value.id ?? "";
}

/**
 * Picks the role a reference names.
 *
 * One picker, three placements: the verifier of an acceptance criterion,
 * and the roles that track and confirm a success criterion. Before
 * 2026-09-28 each of those stored a copy of the role's title and each had
 * its own picker; the copies went stale the moment a role was renamed.
 *
 * A reference the option list does not cover is still shown and still
 * selected, so editing something else never silently drops it. That covers
 * two real cases: a role named in a session that has not saved, and a
 * confirmer outside Cartograph, which is a governance body the vault has no
 * manifest for and should not be made to invent one.
 */
export function RoleRefPicker({
  value,
  options,
  onChange,
  onAddRole,
  label,
  placeholder,
  className,
  "data-cartograph-field": field,
}: {
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
  value: Ref | undefined;
  options: RoleOption[];
  onChange: (ref: Ref | undefined) => void;
  onAddRole: () => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const known = value?.id !== undefined && options.some((o) => o.id === value.id);
  // An external reference has no id to select on, so it rides under a
  // value of its own text; it can never collide with a role id, which is
  // a slug.
  const current = value?.external ?? (value?.id ?? "");

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (v === ADD_ROLE) return onAddRole();
        if (!v) return onChange(undefined);
        const option = options.find((o) => o.id === v);
        onChange(option ? { local: "resources", id: option.id } : { external: v });
      }}
    >
      <SelectTrigger className={className} aria-label={label} data-cartograph-field={field}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {value && !known ? (
          <SelectItem value={current}>{roleRefLabel(value, options)}</SelectItem>
        ) : null}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
        {options.length > 0 ? <SelectSeparator /> : null}
        {/* An action, not another option. Without the mark it sat in the
            same list as the roles and read as one of them, which is the
            one thing a list of nouns must not do to a verb (Programme
            Lead, 2026-09-29). */}
        <SelectItem value={ADD_ROLE} className="text-muted-foreground">
          <Plus />
          {copy.projects.common.nameRole}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
