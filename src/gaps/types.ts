import { Crosshair, Map, ScrollText } from "lucide-react";

import type { DefinitionStep } from "@/definition/Shell";

/** A gap: the distance between where something is and where it should be,
 * the slices it was observed in, and how we know. */
export interface GapSpec {
  /** Where things are now, and where they should be (Kaufman). */
  current?: string;
  desired?: string;
  /** The evidence's own words, quoted. */
  statement?: string;
  measure?: string;
  /** The outcome goals that would be true once this gap is closed (D24). */
  affects?: string[];
  outcomes?: string[];
  segments?: string[];
  source?: string;
  /** Deprecated: one data source, as saved before 2.7.0; read into dataSources. */
  measuredBy?: string;
  dataSources?: string[];
  note?: string;
}

export function blankGapSpec(): GapSpec {
  return {};
}

/** Three steps. The shortfall first because everything else is read
 * against it; scope before evidence because what was observed and where
 * are one thought. */
export const GAP_STEPS: DefinitionStep[] = [
  { section: "shortfall", label: "Gap", to: "/gaps/$id/shortfall", icon: Crosshair },
  { section: "scope", label: "Scope", to: "/gaps/$id/scope", icon: Map },
  { section: "evidence", label: "Evidence", to: "/gaps/$id/evidence", icon: ScrollText },
];
