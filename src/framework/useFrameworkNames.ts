import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { client } from "@/api/client";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { FrameworkNames, MeasureFacts } from "./derive";
import type { Ref } from "@/projects/types";

/** The measures a framework needs, read whole rather than as summaries: a
 * row wants the unit, the direction and the two ends of the distance, and
 * a list carries none of those. Few enough per definition that fetching
 * them is cheaper than a second endpoint. */
function useMeasures(ids: string[]): MeasureFacts[] {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["framework-measure", id],
      staleTime: 30_000,
      queryFn: async (): Promise<MeasureFacts | null> => {
        const res = await client.GET("/manifests/{kind}/{id}", {
          params: { path: { kind: "KPI", id } },
        });
        if (res.error) return null;
        const view = res.data as unknown as {
          manifest?: { metadata?: { name?: string }; spec?: Omit<MeasureFacts, "id" | "name"> & { name?: string } };
        };
        const spec = view.manifest?.spec;
        if (!spec) return null;
        return { ...spec, id, name: spec.name ?? view.manifest?.metadata?.name ?? id };
      },
    })),
  });
  return results.flatMap((r) => (r.data ? [r.data] : []));
}

/**
 * The names behind the ids a framework row shows.
 *
 * Every lookup falls back to the id it was given, so a framework opened
 * while a register is still loading reads as ids rather than as blanks —
 * which is the difference between "still loading" and "nothing here".
 */
export function useFrameworkNames(
  measureIDs: string[],
  role: (ref: Ref | undefined) => string,
): FrameworkNames {
  const goals = useReferenceOptions("Goal");
  const sources = useReferenceOptions("DataSource");
  const cycles = useReferenceOptions("ReportingCycle");
  const assumptions = useReferenceOptions("Assumption");
  const measures = useMeasures(measureIDs);

  return useMemo(
    () => ({
      goal: (id) => goals.data?.names.get(id) ?? id,
      source: (id) => sources.data?.names.get(id) ?? id,
      cycle: (id) => cycles.data?.names.get(id) ?? id,
      assumption: (id) => assumptions.data?.names.get(id) ?? id,
      role,
      measures,
    }),
    [goals.data, sources.data, cycles.data, assumptions.data, measures, role],
  );
}
