import type { ProjectSpec } from "./types";

/**
 * Whether the definition is approved: a definition sign-off signed with
 * anything but a refusal (engine TAXONOMY.md D52). Until then the walk
 * ends at Approval; what happens after it, the record of events and
 * Closure's results, shows once it has (cartograph-engine#80).
 */
export function isApproved(spec: Pick<ProjectSpec, "signOffs" | "events">): boolean {
  const definition = new Set((spec.signOffs ?? []).filter((s) => s.stage === "definition").map((s) => s.id));
  return (spec.events ?? []).some((e) => e.happened === "signed" && "local" in e.on && e.on.local === "signOffs" && definition.has(e.on.id) && e.decision !== "reject");
}
