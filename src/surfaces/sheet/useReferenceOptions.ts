import { useQuery } from "@tanstack/react-query";

import { client } from "@/api/client";

export interface RefOption {
  value: string;
  label: string;
}

export interface RefOptions {
  options: RefOption[];
  names: Map<string, string>;
  /** metadata.labels per entry, which the list carries so a picker can
   * group a long register without fetching every manifest in it. */
  labels: Map<string, Record<string, string>>;
}

/**
 * The query options for one referenced kind's current list: the same
 * queryKey and queryFn are shared by useReferenceOptions (the Add and edit
 * dialog's picker) and by the Sheet's own reference-column cells (via
 * useQueries), so a single fetch's cache entry serves both, per kind.
 * staleTime is 30s: cache is used as-is for normal browsing, but is
 * immediately invalidated after every sheet write (create/edit) to ensure
 * fresh options are shown after mutations.
 */
export function refOptionsQuery(kind: string) {
  return {
    queryKey: ["sheet-ref-options", kind] as const,
    queryFn: async (): Promise<RefOptions> => {
      const { data, error } = await client.GET("/manifests/{kind}", {
        params: { path: { kind } },
      });
      if (error) throw error;
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const options = items.map((s) => ({ value: s.id, label: s.name }));
      const names = new Map(options.map((o) => [o.value, o.label]));
      const labels = new Map(
        items.flatMap((s) => (s.labels ? [[s.id, s.labels] as [string, Record<string, string>]] : [])),
      );
      return { options, names, labels };
    },
    staleTime: 30_000, // 30 seconds; invalidated after writes
  };
}

/**
 * The current summaries of one kind, fetched once and cached, used to feed
 * the reference pickers in the Add and edit dialog.
 */
export function useReferenceOptions(kind: string | undefined) {
  return useQuery({
    ...refOptionsQuery(kind ?? ""),
    enabled: !!kind,
  });
}
