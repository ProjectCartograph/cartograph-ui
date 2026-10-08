import { Gauge, LineChart, Sigma } from "lucide-react";

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
  /** Deprecated: one data source, as saved before 2.7.0; read into sources. */
  source?: string;
  sources?: string[];
  cycle?: string;
  /** The role that answers for the indicator (TAXONOMY.md D44). */
  owner?: { kind?: string; id?: string; external?: string };
  goals?: string[];
  resultLevel?: string;
  disaggregations?: string[];
  /** How it is computed, in the dbt semantic layer's terms (TAXONOMY.md D57). */
  metric?: KPIMetric;
  /** The values a reading must stay within (TAXONOMY.md D58). */
  specLimits?: { lower?: number; upper?: number };
  /** What is done when a reading signals trouble. */
  response?: { trigger: string; action: string; by?: { kind?: string; id?: string }; withinDays?: number };
}

/** An aggregation over one data source's rows (dbt's measure). */
export interface KPIMeasure {
  source: string;
  agg: MeasureAgg;
  expr?: string;
}

export const MEASURE_AGGS = ["count", "sum", "count_distinct", "average", "min", "max", "median", "sum_boolean"] as const;
export type MeasureAgg = (typeof MEASURE_AGGS)[number];

export const METRIC_TYPES = ["simple", "ratio", "cumulative", "derived"] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export interface KPIMetric {
  type: MetricType;
  measure?: KPIMeasure;
  numerator?: KPIMeasure;
  denominator?: KPIMeasure;
  window?: string;
  expr?: string;
  uses?: string[];
  filter?: string;
}

export function blankKPISpec(): KPIDefinitionSpec {
  return {};
}

/** Two steps: what is measured, and what it read. The definition first,
 * because every reading is read against it. */
export const KPI_STEPS: DefinitionStep[] = [
  { section: "definition", label: "Definition", to: "/kpis/$id/definition", icon: Gauge },
  { section: "metric", label: "Metric", to: "/kpis/$id/metric", icon: Sigma },
  { section: "readings", label: "Actuals", to: "/kpis/$id/readings", icon: LineChart },
];
