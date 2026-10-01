import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { ProjectManifest } from "./types";

export function useProjectManifest(id: string | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["project-manifest", id],
    enabled: !!id,
    queryFn: async () => {
      const data = await client.get("Project", id as string);
      // Manifest.spec is contractually generic; kind-specific UI code reads
      // it back into its own typed shape (see types.ts), the same as Goal.
      return data as unknown as { version: { number: number }; manifest: ProjectManifest; yaml: string };
    },
  });
}

export function useProjectChecks(id: string | undefined, _draft?: boolean) {
  const client = useClient();
  return useQuery({
    queryKey: ["project-checks", id],
    enabled: !!id,
    queryFn: () => client.checks("Project", id as string),
  });
}

export function useProjectState(id: string | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["project-state", id],
    enabled: !!id,
    queryFn: () => client.projectState(id as string),
  });
}

export function useProjectVersions(id: string | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["project-versions", id],
    enabled: !!id,
    queryFn: () => client.versions("Project", id as string),
  });
}
