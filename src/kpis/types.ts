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
export interface KPIDefinitionSpec {
  name?: string;
  definition?: string;
  unit?: string;
  direction?: string;
  baseline?: { value: number; date: string };
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
