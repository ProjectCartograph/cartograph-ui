import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { GlossaryEntry } from "@/client/port";
import { copy } from "@/copy";

const gc = copy.glossary;

/**
 * The taxonomy as a dictionary gives it (TAXONOMY.md D29): every word,
 * with the engine's one plain sentence and an example, in the order of
 * work. It changes only with a release, so it is read once.
 */
export function useGlossary() {
  const client = useClient();
  return useQuery({ queryKey: ["glossary"], queryFn: () => client.glossary(), staleTime: Infinity, retry: false });
}

/** A word as a person reads it: a stage's key, or a register's kind. */
export const termOf = (key: string) => gc.term[key] ?? key;

/** One entry by its key: a stage of the order of work, or a register. */
export function entryFor(entries: GlossaryEntry[] | undefined, key: string): GlossaryEntry | undefined {
  return entries?.find((e) => e.key === key);
}
