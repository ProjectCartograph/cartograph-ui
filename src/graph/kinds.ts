// How the workspace graph colours each kind. Where each node goes, and
// how far it is from another, are the engine's (GET /graph), so every
// interface draws the same graph; the colours are this one's own.

/** A colour per kind, readable on light and dark alike. */
export const KIND_COLOR: Record<string, string> = {
  Goal: "#7c3aed",
  KPI: "#0891b2",
  Gap: "#e11d48",
  Programme: "#2563eb",
  Project: "#4f46e5",
  Operation: "#059669",
  StakeholderMap: "#c026d3",
  Assumption: "#d97706",
  Team: "#0d9488",
  Resource: "#65a30d",
  FundingSource: "#ca8a04",
  DataSource: "#0284c7",
  ReportingCycle: "#9333ea",
  Unit: "#57534e",
  Segment: "#db2777",
  BeneficiaryGroup: "#ea580c",
};

export const colorOf = (kind: string) => KIND_COLOR[kind] ?? "#64748b";
