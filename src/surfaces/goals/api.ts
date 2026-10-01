import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { Client } from "@/client/port";
import type { GoalManifest } from "./types";

export function useGoalTree() {
  const client = useClient();
  return useQuery({
    queryKey: ["goal-tree"],
    queryFn: () => client.goalTree(),
  });
}

export function useSettings() {
  const client = useClient();
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => client.settings(),
    staleTime: 60_000,
  });
}

export function useGoalChecks(id: string | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["goal-checks", id],
    enabled: !!id,
    queryFn: () => client.checks("Goal", id as string),
  });
}

/**
 * Shared query options for one goal's references, keyed the same way
 * whether fetched one at a time (the editor, via useGoalReferences) or in
 * bulk (the Goals home page's per-card aligned chips, via useQueries), so
 * a single fetch's cache entry serves both.
 */
export function goalReferencesQueryOptions(client: Client, id: string) {
  return {
    queryKey: ["goal-references", id] as const,
    queryFn: () => client.references("Goal", id),
  };
}

export function useGoalReferences(id: string | undefined) {
  const client = useClient();
  return useQuery({ ...goalReferencesQueryOptions(client, id ?? ""), enabled: !!id });
}

export function projectReferencesQueryOptions(client: Client, id: string) {
  return {
    queryKey: ["project-references", id] as const,
    queryFn: () => client.references("Project", id),
  };
}

export function useGoalManifest(id: string | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["goal-manifest", id],
    enabled: !!id,
    queryFn: async () => {
      const data = await client.get("Goal", id as string);
      // Manifest.spec is contractually generic; this project's kind-specific
      // surfaces read it back into their own typed shape (see types.ts).
      return data as unknown as { version: { number: number }; manifest: GoalManifest; yaml: string };
    },
  });
}
