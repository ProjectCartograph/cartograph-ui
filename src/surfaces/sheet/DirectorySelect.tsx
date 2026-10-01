import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DirectoryEmptyHint } from "./DirectoryEmpty";
import type { RefOption } from "./useReferenceOptions";

/**
 * A stock shadcn Select fed by one referenced kind's current list, for the
 * (more common) single-directory case ReferenceField's own Combobox does
 * not cover. Same rule as ReferenceField: once the directory is confirmed
 * empty, the Select is replaced entirely by the stock empty message, never
 * shown as a required or optional picker with zero options.
 */
export function DirectorySelect({
  kind,
  value,
  onValueChange,
  options,
  loading,
  placeholder,
  className,
  "data-cartograph-field": field,
}: {
  kind: string;
  value: string;
  onValueChange: (v: string) => void;
  options: RefOption[];
  loading?: boolean;
  placeholder?: string;
  className?: string;
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
}) {
  if (!loading && options.length === 0) {
    return <DirectoryEmptyHint kind={kind} />;
  }
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className ?? "w-full"} data-cartograph-field={field}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
