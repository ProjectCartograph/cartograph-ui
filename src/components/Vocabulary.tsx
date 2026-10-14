import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { VocabName } from "@/components/vocab";
import { VocabOption } from "@/components/vocab";
import { useVocabulary } from "./useVocabulary";

/** The marks the interface has for a vocabulary's standard terms; a
 * workspace's own terms read in words alone. */
const MARKS: Record<string, VocabName> = { refresh: "refresh", dataSourceCategory: "dataSourceCategory" };

/**
 * A choice from one of the workspace's vocabularies (engine TAXONOMY.md
 * D71): its classification levels, how often a source changes, the form a
 * source takes. The terms are the workspace's, served with its settings,
 * each with what it means under its name. A value the list does not have
 * still shows, as written, so nothing a record holds is hidden.
 */
export function VocabularyChoice({
  vocabulary,
  value,
  onChange,
  label,
  field,
  className = "w-full",
}: {
  vocabulary: string;
  value: string | undefined;
  onChange: (next: string) => void;
  label: string;
  field?: string;
  className?: string;
}) {
  const terms = useVocabulary(vocabulary);
  const mark = MARKS[vocabulary];
  const known = terms.some((t) => t.value === value);
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className={className} aria-label={label} data-cartograph-field={field}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {value && !known ? <SelectItem value={value}>{value}</SelectItem> : null}
        {terms.map((t) => (
          <SelectItem key={t.value} value={t.value} hint={t.description || undefined}>
            {mark ? <VocabOption vocab={mark} value={t.value} label={t.label} /> : t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
