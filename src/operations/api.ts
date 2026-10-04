import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";

/** An operation's advisory checks, one list for every step. */
export function useOperationChecks(id: string, enabled = true) {
  const client = useClient();
  return useQuery({
    queryKey: ["operation-checks", id],
    enabled,
    queryFn: () => client.checks("Operation", id),
  });
}

/** What of one kind names a manifest: the projects that land in a
 * service, say. Empty while nothing does. */
export function useReferencing(kind: string, id: string, from: string) {
  const client = useClient();
  return useQuery({
    queryKey: ["referencing", kind, id, from],
    enabled: !!id,
    queryFn: async () => (await client.references(kind, id)).incoming.filter((s) => s.kind === from),
  });
}
