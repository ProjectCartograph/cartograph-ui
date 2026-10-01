import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import { orUndefined } from "@/client/port";

/** One manifest's display name, for a breadcrumb that should read as the
 * thing rather than as its id. */
export function useManifestName(kind: string, id: string | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["manifest-name", kind, id],
    enabled: Boolean(id),
    staleTime: 30_000,
    queryFn: async (): Promise<string | undefined> => {
      if (!id) return undefined;
      const view = await orUndefined(client.get(kind, id));
      return (view as unknown as { manifest?: { metadata?: { name?: string } } } | undefined)?.manifest
        ?.metadata?.name;
    },
  });
}
