import type { Waits, WaitsNode } from "@/client/port";
import { monthNames } from "@/components/locale";
import { copy } from "@/copy";
import type { MapNode } from "./links";

const wc = copy.projectMap.waits;

/** A dated item on the map, where the engine laid it out. */
export interface WaitsPlaced extends MapNode {
  x: number;
  y: number;
  waits: WaitsNode;
}

// The engine lays a band to a month from the top down, its items a
// column apart; the map's nodes are wider than that column.
const SPREAD = 1.6;

/** The engine's graph of waits as the map draws it: nodes where the engine
 * placed them, an edge from what comes first to what waits on it, and a
 * label for each month's band. Nothing is placed here. */
export function waitsMap(g: Waits | undefined): {
  nodes: WaitsPlaced[];
  edges: { from: WaitsPlaced; to: WaitsPlaced; tone: "critical" | "plain" }[];
  lines: { row: number; y: number; label: string }[];
} {
  if (!g || g.nodes.length === 0) return { nodes: [], edges: [], lines: [] };
  const left = Math.min(...g.nodes.map((n) => n.x));
  const nodes = g.nodes.map((n, i) => ({
    key: `${n.record.kind}/${n.record.id}#${n.item ?? `${n.kind}-${i}`}`,
    kind: n.record.kind,
    id: n.record.id,
    item: n.item,
    name: n.name,
    x: (n.x - left) * SPREAD,
    y: n.y,
    waits: n,
  }));
  const edges = g.edges
    .filter((e) => nodes[e.from] && nodes[e.to])
    .map((e) => ({ from: nodes[e.from], to: nodes[e.to], tone: (nodes[e.from].waits.critical && nodes[e.to].waits.critical ? "critical" : "plain") as "critical" | "plain" }));
  // One label for each band: the month its items fall in, or none.
  const bands = new Map<number, string>();
  for (const n of nodes) if (!bands.has(n.y)) bands.set(n.y, n.waits.month ? monthWords(n.waits.month) : wc.unplaced);
  const lines = [...bands.entries()].sort((a, b) => a[0] - b[0]).map(([y, label], row) => ({ row, y, label }));
  return { nodes, edges, lines };
}

/** A month as people say it: "July 2027". */
export function monthWords(m: string | undefined): string {
  if (!m) return "";
  const [y, mm] = m.split("-");
  const name = monthNames()[Number(mm) - 1];
  return name ? `${name} ${y}` : m;
}

/** What an item's timing says, in words: "2 months after Pilot starts". */
export function timingWords(n: WaitsNode): string {
  const t = (n.timing ?? {}) as { form?: string; date?: string; notBefore?: string; notAfter?: string; lagMonths?: number; lagDays?: number; expectedBy?: string };
  const follows = n.follows ?? wc.somethingElse;
  switch (t.form) {
    case "date":
      return monthWords(t.date?.slice(0, 7));
    case "window":
      return wc.window(monthWords(t.notBefore?.slice(0, 7)), monthWords(t.notAfter?.slice(0, 7)));
    case "after":
      return wc.after(t.lagMonths ?? 0, t.lagDays ?? 0, follows);
    case "when":
      return wc.when(follows, monthWords(t.expectedBy?.slice(0, 7)));
    default:
      return n.kind === "ready" ? wc.ready : "";
  }
}
