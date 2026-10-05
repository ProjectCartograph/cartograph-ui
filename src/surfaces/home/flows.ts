/** The stages a person defines, in the order of work (engine GET /order),
 * each opening the flow that defines it. */
export const FLOW_KEYS = ["purpose", "goal", "objective", "outcome", "kpi", "gap", "assumption", "portfolio", "programme", "operation", "project"] as const;

/** Where a stage is defined, with what was typed as its name where the
 * flow takes one. Never New: the person has already said what it is. */
export function flowLink(key: string, name: string): { to: string; search?: Record<string, string> } {
  const named: Record<string, string> = name ? { name } : {};
  switch (key) {
    case "purpose":
      return { to: "/strategy" };
    case "goal":
    case "objective":
    case "outcome":
      return { to: "/goals", search: { add: key, ...named } };
    case "kpi":
      return { to: "/kpis", search: { add: "1", ...named } };
    case "assumption":
      return { to: "/sheets/Assumption", search: { add: "1", ...named } };
    case "gap":
    case "portfolio":
    case "programme":
    case "operation":
      return { to: `/${key}s/new`, search: named };
    // A project starts in the walker, what was typed being what it is
    // about, not its name: naming it comes last (projects/start).
    case "project":
      return { to: "/projects/start", search: name ? { about: name.slice(0, 300) } : {} };
    default:
      return { to: "/new" };
  }
}

/** A name from what was typed: its first sentence, short enough to be one. */
export function nameFrom(text: string): string {
  const first = text.trim().split(/(?<=[.!?])\s|\n/)[0] ?? "";
  return first.replace(/[.!?]+$/, "").slice(0, 160);
}
