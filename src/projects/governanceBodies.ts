import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";

/** A governance body as a picker offers it. */
export interface BodyOption {
  id: string;
  label: string;
}

/**
 * The governance bodies in the Resource catalogue: committees and boards
 * that decide, named once and referenced like a role (TAXONOMY.md D43).
 * Read only when asked for, so a picker that offers none costs nothing.
 */
export function useGovernanceBodies(enabled = true): BodyOption[] {
  const client = useClient();
  const { data } = useQuery({
    enabled,
    queryKey: ["governance-bodies"],
    queryFn: async () => {
      const rows = (await client.list("Resource", { expand: "spec" })) as { id: string; name: string; spec?: { category?: string } }[];
      return rows.filter((r) => r.spec?.category === "governanceBody").map((r) => ({ id: r.id, label: r.name }));
    },
  });
  return enabled ? (data ?? []) : [];
}

