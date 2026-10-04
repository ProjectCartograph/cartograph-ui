import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";

/** What the work on screen is about, set by WorkTextProvider. */
export const WorkText = createContext("");

/** The records of kind most relevant to the work on screen, likeliest
 * first, and whether a decision model ranked them. */
export function useRelevant(kind: string, level?: string) {
  const client = useClient();
  const text = useContext(WorkText);
  const enabled = text.trim().split(/\s+/).length >= 3;
  const q = useQuery({
    queryKey: ["relevant", kind, level ?? "", text],
    queryFn: () => client.relevant(text, [kind], level),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { matches: enabled ? (q.data?.matches ?? []) : [], byModel: q.data?.available ?? false };
}

