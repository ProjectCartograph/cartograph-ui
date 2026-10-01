import { useQuery } from "@tanstack/react-query";

import { client } from "@/api/client";
import type { GoalManifest } from "./types";

export function useGoalTree() {
  return useQuery({
    queryKey: ["goal-tree"],
    queryFn: async () => {
      const { data, error } = await client.GET("/goals/tree");
      if (error) throw error;
      return data;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await client.GET("/settings");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

export function useGoalChecks(id: string | undefined) {
  return useQuery({
    queryKey: ["goal-checks", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/Goal/{id}/checks", {
        params: { path: { id: id as string } },
      });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Shared query options for one goal's references, keyed the same way
 * whether fetched one at a time (the editor, via useGoalReferences) or in
 * bulk (the Goals home page's per-card aligned chips, via useQueries), so
 * a single fetch's cache entry serves both.
 */
export function goalReferencesQueryOptions(id: string) {
  return {
    queryKey: ["goal-references", id] as const,
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}/{id}/references", {
        params: { path: { kind: "Goal", id } },
      });
      if (error) throw error;
      return data;
    },
  };
}

export function useGoalReferences(id: string | undefined) {
  return useQuery({ ...goalReferencesQueryOptions(id ?? ""), enabled: !!id });
}

export function projectReferencesQueryOptions(id: string) {
  return {
    queryKey: ["project-references", id] as const,
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}/{id}/references", {
        params: { path: { kind: "Project", id } },
      });
      if (error) throw error;
      return data;
    },
  };
}

export function useGoalManifest(id: string | undefined) {
  return useQuery({
    queryKey: ["goal-manifest", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}/{id}", {
        params: { path: { kind: "Goal", id: id as string } },
      });
      if (error) throw error;
      // Manifest.spec is contractually generic; this project's kind-specific
      // surfaces read it back into their own typed shape (see types.ts).
      return data as unknown as { version: { number: number }; manifest: GoalManifest; yaml: string };
    },
  });
}
