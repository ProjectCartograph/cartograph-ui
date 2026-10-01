import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";

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
  const client = useClient();
  return useQuery({
    queryKey: ["gap-coverage", id],
    queryFn: (): Promise<GapCoverage> => client.gapCoverage(id),
  });
}

/** A gap's advisory checks. */
export function useGapChecks(id: string, enabled = true) {
  const client = useClient();
  return useQuery({
    queryKey: ["gap-checks", id],
    enabled,
    queryFn: () => client.checks("Gap", id),
  });
}
