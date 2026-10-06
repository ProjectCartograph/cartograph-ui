import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copy } from "@/copy";
import { ReferencePicker } from "./ReferencePicker";

/** A reference in Cartograph's one shape, as a sheet field holds it. */
export type RefValue = { kind?: string; id?: string; external?: string } | undefined;

/**
 * A field that names someone by reference: an entry from the Resource
 * catalogue, or a party outside the workspace by name. Written as the
 * contract's reference ({"kind":"Resource","id"} or {"external"}), never
 * as a bare name.
 */
export function RefObjectField({
  value,
  onChange,
  pointer,
}: {
  value: RefValue;
  onChange: (next: RefValue) => void;
  pointer: string;
}) {
  const c = copy.sheets.refObject;
  const outside = value?.external !== undefined;
  return (
    <div className="flex flex-col gap-2" data-cartograph-field={pointer}>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={outside ? "outside" : "catalogue"}
        onValueChange={(v) => v && onChange(v === "outside" ? { external: "" } : undefined)}
        aria-label={c.formLabel}
        className="self-start"
      >
        <ToggleGroupItem value="catalogue">{c.catalogue}</ToggleGroupItem>
        <ToggleGroupItem value="outside">{c.outside}</ToggleGroupItem>
      </ToggleGroup>
      {outside ? (
        <Input
          value={value?.external ?? ""}
          onChange={(e) => onChange({ external: e.target.value.slice(0, 120) })}
          aria-label={c.outsideName}
        />
      ) : (
        <ReferencePicker
          refKind="Resource"
          value={value?.kind === "Resource" ? value.id : undefined}
          onChange={(id) => onChange(id ? { kind: "Resource", id } : undefined)}
          label={c.catalogue}
        />
      )}
    </div>
  );
}
