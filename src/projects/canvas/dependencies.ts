import type { ComponentGraph, ComponentNode } from "@/client/port";
import type { MapNode } from "./links";

/** A piece of work on the dependency map, with its marks. */
export interface WorkNode extends MapNode {
  marks: Pick<ComponentNode, "inLoop" | "critical" | "mostDependedOn">;
}

/** How a line between two pieces of work is drawn. */
export type Tone = "loop" | "critical" | "plain";

const key = (r: { kind: string; id: string }) => `${r.kind}/${r.id}`;

/**
 * Every project and programme in rows: work nothing depends on at the
 * top, each component a row below the deepest work that lists it, so a
 * line always runs downward from the work to what it depends on. Work
 * with no link at all sits in the last row, where a link can be drawn
 * to it. A loop has no deepest point, so its rows stop growing after as
 * many passes as there is work.
 */
export function dependencyRows(graph: ComponentGraph): { rows: WorkNode[][]; tones: Map<string, Tone>; legacy: Set<string>; loose: boolean } {
  const row = new Map<string, number>(graph.nodes.map((n) => [key(n), 0]));
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let moved = false;
    for (const e of graph.edges) {
      const want = (row.get(key(e.from)) ?? 0) + 1;
      if (want > (row.get(key(e.to)) ?? 0) && want < graph.nodes.length) {
        row.set(key(e.to), want);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const linked = new Set(graph.edges.flatMap((e) => [key(e.from), key(e.to)]));
  const deepest = Math.max(0, ...[...row.values()]);
  const rows: WorkNode[][] = [];
  for (const n of graph.nodes) {
    const r = linked.has(key(n)) ? (row.get(key(n)) ?? 0) : deepest + 1;
    (rows[r] ??= []).push({
      key: key(n),
      kind: n.kind,
      id: n.id,
      name: n.name,
      marks: { inLoop: n.inLoop, critical: n.critical, mostDependedOn: n.mostDependedOn },
    });
  }
  const tones = new Map<string, Tone>();
  const pairs = (list: { kind: string; id: string }[]) => list.slice(1).map((r, i) => `${key(list[i])}>${key(r)}`);
  for (const p of pairs(graph.criticalPath)) tones.set(p, "critical");
  // A loop outranks the critical path: it is the one that must be fixed.
  for (const loop of graph.loops) for (const p of pairs(loop)) tones.set(p, "loop");
  const legacy = new Set(graph.edges.filter((e) => e.legacy).map((e) => `${key(e.from)}>${key(e.to)}`));
  return { rows: rows.filter(Boolean), tones, legacy, loose: graph.nodes.some((n) => !linked.has(key(n))) };
}
