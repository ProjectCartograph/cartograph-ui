import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";

/** What each budget has allocated this project, by the budget, as its
 * holder recorded it (engine TAXONOMY.md D69). */
export type Allocation = { amount?: number; currency?: string; status?: "approved" | "requested" | "unfunded" };

export function useAllocations(project: string): Map<string, Allocation> {
  const client = useClient();
  const q = useQuery({ queryKey: ["allocations"], queryFn: () => client.list("Allocation", { expand: "spec" }), staleTime: 30_000 });
  const out = new Map<string, Allocation>();
  for (const r of q.data ?? []) {
    const spec = (r as { spec?: Allocation & { source?: string; project?: string } }).spec;
    if (spec?.project === project && spec.source) out.set(spec.source, spec);
  }
  return out;
}
