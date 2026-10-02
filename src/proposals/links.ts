import type { Proposal } from "@/client/port";

/** Where a proposal's manifest is edited. KPI readings live under their
 * KPI; registers are edited in their sheet. */
export function manifestLink(p: Pick<Proposal, "kind" | "manifestId" | "manifest">): { to: string; params: Record<string, string> } {
  const id = p.manifestId;
  switch (p.kind) {
    case "Goal":
      return { to: "/goals/$id", params: { id } };
    case "Project":
      return { to: "/projects/$id", params: { id } };
    case "Programme":
      return { to: "/programmes/$id", params: { id } };
    case "Operation":
      return { to: "/operations/$id", params: { id } };
    case "Gap":
      return { to: "/gaps/$id", params: { id } };
    case "KPI":
      return { to: "/kpis/$id", params: { id } };
    case "KPIReadings": {
      const spec = (p.manifest?.spec ?? {}) as { kpi?: string };
      return { to: "/kpis/$id/readings", params: { id: spec.kpi ?? id.replace(/-readings$/, "") } };
    }
    default:
      return { to: "/sheets/$kind", params: { kind: p.kind } };
  }
}
