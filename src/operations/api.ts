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
