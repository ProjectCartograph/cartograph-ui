import { useQuery } from "@tanstack/react-query";

import { client } from "@/api/client";

/** An operation's advisory checks, one list for every step. */
export function useOperationChecks(id: string, enabled = true) {
  return useQuery({
    queryKey: ["operation-checks", id],
    enabled,
    queryFn: async () => {
      const res = await client.GET("/manifests/Operation/{id}/checks", { params: { path: { id } } });
      if (res.error) throw new Error("checks");
      return res.data ?? [];
    },
  });
}
