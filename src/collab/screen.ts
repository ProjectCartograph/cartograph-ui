import type { PresenceScreen } from "@/client/port";

/** The manifest a route is about, by its route id and params; null for a
 * screen about none (lists, the goal tree, snapshots). */
export function screenFor(routeId: string | undefined, params: Record<string, string>): PresenceScreen {
  if (!routeId || !params.id) return null;
  const kinds: [string, string][] = [
    ["/projects/$id", "Project"],
    ["/programmes/$id", "Programme"],
    ["/operations/$id", "Operation"],
    ["/gaps/$id", "Gap"],
    ["/kpis/$id", "KPI"],
    ["/goals/$id", "Goal"],
  ];
  for (const [prefix, kind] of kinds) {
    if (routeId === prefix || routeId.startsWith(prefix + "/")) return { kind, id: params.id };
  }
  return null;
}
