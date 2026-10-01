import { useQuery } from "@tanstack/react-query";

import { client } from "@/api/client";

/** One manifest's display name, for a breadcrumb that should read as the
 * thing rather than as its id. */
export function useManifestName(kind: string, id: string | undefined) {
  return useQuery({
    queryKey: ["manifest-name", kind, id],
    enabled: Boolean(id),
    staleTime: 30_000,
    queryFn: async (): Promise<string | undefined> => {
      if (!id) return undefined;
      const { data, error } = await client.GET("/manifests/{kind}/{id}", {
        params: { path: { kind, id } },
      });
      if (error || !data) return undefined;
      return (data as unknown as { manifest?: { metadata?: { name?: string } } }).manifest?.metadata
        ?.name;
    },
  });
}
