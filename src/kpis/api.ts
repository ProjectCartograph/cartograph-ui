import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";

export interface KPISpec {
  name?: string;
  definition?: string;
  unit?: string;
  direction?: string;
  baseline?: { value: number; date: string };
  target?: { value: number; date: string };
  source?: string;
  cycle?: string;
  goals?: string[];
}

/** A KPI's own definition. Read-only here: what is measured is decided
 * where the KPI is defined, and this surface is for the numbers. */
export function useKPI(id: string) {
  const client = useClient();
  return useQuery({
    queryKey: ["kpi", id],
    queryFn: async () => {
      const view = (await client.get("KPI", id)) as unknown as {
        manifest?: { metadata?: { name?: string }; spec?: KPISpec };
      };
      return { name: view.manifest?.metadata?.name ?? id, spec: view.manifest?.spec ?? {} };
    },
  });
}

/** The cycle a KPI is read on, which is what says what its periods are:
 * equal ones (periodMonths from startMonth), or named ones (periods). */
export function useCycle(id: string | undefined) {
  const client = useClient();
  return useQuery({
    enabled: !!id,
    queryKey: ["cycle", id],
    queryFn: async () => {
      const view = (await client.get("ReportingCycle", id!)) as unknown as {
        manifest?: {
          metadata?: { name?: string };
          spec?: { periodMonths?: number; startMonth?: number; periods?: { name: string }[] };
        };
      };
      return {
        name: view.manifest?.metadata?.name ?? id!,
        periodMonths: view.manifest?.spec?.periodMonths ?? 0,
        startMonth: view.manifest?.spec?.startMonth ?? 1,
        periodNames: (view.manifest?.spec?.periods ?? []).map((p) => p.name),
      };
    },
  });
}

/** A cycle's periods between two months, as the engine lays them out. */
export function useCyclePeriods(id: string | undefined, span: { from: string; to: string } | null) {
  const client = useClient();
  return useQuery({
    enabled: !!id && !!span,
    queryKey: ["cyclePeriods", id, span?.from, span?.to],
    queryFn: () => client.cyclePeriods(id!, span!.from, span!.to),
  });
}

/** The id a KPI's series lives under. Derived rather than stored, the way
 * a project's stakeholder map is, so there is nothing to keep in step. */
export function readingsID(kpiID: string): string {
  return `${kpiID}-readings`.slice(0, 63);
}
