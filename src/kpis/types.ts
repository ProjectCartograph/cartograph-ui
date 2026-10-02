import { Gauge, LineChart } from "lucide-react";

import type { DefinitionStep } from "@/definition/Shell";
import type { Reading } from "./periods";

export type { Reading } from "./periods";

/** A KPI's series: which KPI, and what it read. */
export interface KPIReadingsSpec {
  kpi?: string;
  readings?: Reading[];
}

export function blankReadings(kpi: string): () => KPIReadingsSpec {
  return () => ({ kpi });
}

/** What a KPI says about itself. Its baseline and target are also what a
 * Gap's two states are, which is why a measured gap references a KPI
 * rather than restating a pair of numbers (TAXONOMY.md D9). */
/** A KPI's baseline: today's figure as of a month, or an admitted unknown
 * with the reason (TAXONOMY.md D25: every measure has one or the other). */
export type KPIBaseline = { value: number; date: string } | { unknownReason: string; expectedBy?: string };

/** The baseline's figure, when it is known. */
export function knownBaseline(b: KPIBaseline | undefined): { value: number; date: string } | undefined {
  return b && "value" in b ? b : undefined;
}

export interface KPIDefinitionSpec {
  definition?: string;
  unit?: string;
  direction?: string;
  baseline?: KPIBaseline;
  target?: { value: number; date: string };
  source?: string;
  cycle?: string;
  goals?: string[];
  resultLevel?: string;
  disaggregations?: string[];
}

export function blankKPISpec(): KPIDefinitionSpec {
  return {};
}

/** Two steps: what is measured, and what it read. The definition first,
 * because every reading is read against it. */
export const KPI_STEPS: DefinitionStep[] = [
  { section: "definition", label: "Definition", to: "/kpis/$id/definition", icon: Gauge },
  { section: "readings", label: "Actuals", to: "/kpis/$id/readings", icon: LineChart },
];
