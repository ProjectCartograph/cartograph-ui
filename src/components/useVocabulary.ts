import { useSettings } from "@/surfaces/goals/api";

export type VocabularyTerm = { value: string; label: string; description?: string };

/** One of the workspace's vocabularies, as its settings serve it (engine
 * TAXONOMY.md D71): the standard terms unless the workspace set its own. */
export function useVocabulary(name: string): VocabularyTerm[] {
  const { data } = useSettings();
  return ((data as { vocabularies?: Record<string, VocabularyTerm[]> } | undefined)?.vocabularies?.[name] ?? []) as VocabularyTerm[];
}

/** What a person reads for a stored value: the workspace's word, else the
 * value as written. */
export function useVocabularyWord(name: string): (value: string | undefined) => string {
  const terms = useVocabulary(name);
  return (value) => (value ? (terms.find((t) => t.value === value)?.label ?? value) : "");
}

/** Every vocabulary's words at once: (vocabulary, value) to what a person
 * reads, the value as written where the list does not have it. */
export function useVocabularyWords(): (name: string, value: string) => string {
  const { data } = useSettings();
  const all = (data as { vocabularies?: Record<string, VocabularyTerm[]> } | undefined)?.vocabularies ?? {};
  return (name, value) => all[name]?.find((t) => t.value === value)?.label ?? value;
}
