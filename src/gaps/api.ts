import { useQuery } from "@tanstack/react-query";

import { client } from "@/api/client";

export interface GapClaim {
  kind: string;
  id: string;
  name: string;
  segments?: string[];
  whole: boolean;
}

export interface GapSegmentCoverage {
  segment: string;
  name: string;
  addressedBy?: GapClaim[];
}

export interface GapCoverage {
  gap: string;
  segments: GapSegmentCoverage[];
  whole?: GapClaim[];
}

/**
 * Which part of this gap each piece of work addresses.
 *
 * Derived from the citations, never stored: work declares what it reaches
 * and this reads it back, the same way a programme's members are derived.
 */
export function useGapCoverage(id: string) {
  return useQuery({
    queryKey: ["gap-coverage", id],
    queryFn: async (): Promise<GapCoverage> => {
      const res = await client.GET("/manifests/Gap/{id}/coverage", {
        params: { path: { id } },
      });
      if (res.error) throw new Error("coverage");
      return res.data as GapCoverage;
    },
  });
}

/** A gap's advisory checks. */
export function useGapChecks(id: string, enabled = true) {
  return useQuery({
    queryKey: ["gap-checks", id],
    enabled,
    queryFn: async () => {
      const res = await client.GET("/manifests/Gap/{id}/checks", {
        params: { path: { id } },
      });
      if (res.error) throw new Error("checks");
      return res.data ?? [];
    },
  });
}
