import { useQuery } from "@tanstack/react-query";

import { client } from "@/api/client";
import type { ProjectManifest } from "./types";

export function useProjectManifest(id: string | undefined) {
  return useQuery({
    queryKey: ["project-manifest", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}/{id}", {
        params: { path: { kind: "Project", id: id as string } },
      });
      if (error) throw error;
      // Manifest.spec is contractually generic; kind-specific UI code reads
      // it back into its own typed shape (see types.ts), the same as Goal.
      return data as unknown as { version: { number: number }; manifest: ProjectManifest; yaml: string };
    },
  });
}

export function useProjectChecks(id: string | undefined, _draft?: boolean) {
  return useQuery({
    queryKey: ["project-checks", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/Project/{id}/checks", {
        params: { path: { id: id as string } },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useProjectState(id: string | undefined) {
  return useQuery({
    queryKey: ["project-state", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/Project/{id}/state", {
        params: { path: { id: id as string } },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useProjectVersions(id: string | undefined) {
  return useQuery({
    queryKey: ["project-versions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}/{id}/versions", {
        params: { path: { kind: "Project", id: id as string } },
      });
      if (error) throw error;
      return data;
    },
  });
}
