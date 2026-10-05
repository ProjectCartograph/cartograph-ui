import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { Guide, GuideField } from "@/client/port";

/**
 * A kind's guide, for one level: the engine's words for each field, with
 * right and wrong examples, and the words an editor may offer (engine
 * contract/guidance). Agents read the same guide, so a person and an
 * agent are held to one description of good. It changes only with a
 * release, so it is read once.
 */
export function useGuide(kind: string, level?: string) {
  const client = useClient();
  return useQuery({
    queryKey: ["guide", kind, level ?? ""],
    queryFn: () => client.getGuide(kind, { level }),
    staleTime: Infinity,
    retry: false,
  });
}

/** One field's guidance, by its JSON pointer; list items as /-/. */
export function fieldGuide(guide: Guide | undefined, path: string): GuideField | undefined {
  for (const step of guide?.steps ?? []) {
    const found = step.fields.find((f) => f.path === path);
    if (found) return found;
  }
  return undefined;
}

/** Whether text holds a digit, in any script. */
export const hasDigit = (s: string) => /\p{Nd}/u.test(s);
