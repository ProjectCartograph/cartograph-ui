// What this person opened last, kept in this browser only: a convenience,
// not a record (it is nobody else's business, and it is lost with the
// browser's storage, harmlessly).

export interface Visit {
  kind: string;
  id: string;
  at: number;
}

const KEY = "cartograph.recent";
const MAX = 12;

/** The record a route shows, by its path: /projects/p1/... is Project p1. */
const KINDS: Record<string, string> = {
  projects: "Project",
  programmes: "Programme",
  portfolios: "Portfolio",
  operations: "Operation",
  goals: "Goal",
  kpis: "KPI",
  gaps: "Gap",
};
const NOT_IDS = new Set(["new", "start", "prepare"]);

export function recordOf(pathname: string): { kind: string; id: string } | undefined {
  const [, area, id] = pathname.split("/");
  const kind = KINDS[area ?? ""];
  if (!kind || !id || NOT_IDS.has(id)) return undefined;
  return { kind, id: decodeURIComponent(id) };
}

export function recentVisits(): Visit[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as Visit[]).filter((v) => v && typeof v.kind === "string" && typeof v.id === "string") : [];
  } catch {
    return [];
  }
}

export function noteVisit(kind: string, id: string, at = Date.now()) {
  try {
    const rest = recentVisits().filter((v) => !(v.kind === kind && v.id === id));
    localStorage.setItem(KEY, JSON.stringify([{ kind, id, at }, ...rest].slice(0, MAX)));
  } catch {
    // Private windows refuse storage: Home just shows nothing recent.
  }
}
