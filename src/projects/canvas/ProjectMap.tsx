import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hand, Link2, Maximize, Minus, MousePointer2, Plus } from "lucide-react";

import { useClient } from "@/client/context";
import type { LinkCandidate } from "@/client/port";
import { Button } from "@/components/ui/button";
import { kindIcon } from "@/components/vocab";
import { copy } from "@/copy";
import { colorOf } from "@/graph/kinds";
import type { ProjectSpec } from "../types";
import { linkFor, linksFrom, setLink, type MapNode } from "./links";

const mc = copy.projectMap;

type Mode = "select" | "connect" | "move";

// The project's results chain, top to bottom, which suits a pane taller
// than it is wide: the strategy it serves, the evidence, its problems,
// the project, and who and what it reaches.
const ROW: Record<string, number> = { goal: 0, objective: 1, outcome: 2, Gap: 3, KPI: 3, Problem: 4, Project: 5, BeneficiaryGroup: 6, Operation: 6 };
const KEEP = new Set(["Project", "Goal", "Gap", "KPI", "BeneficiaryGroup", "Operation"]);
const W = 172;
const H = 48;
const GAP_X = 20;
const GAP_Y = 56;

interface Placed extends MapNode {
  x: number;
  y: number;
}

interface Edge {
  from: Placed;
  to: Placed;
  link?: ReturnType<typeof linkFor>;
}

/**
 * The project as a map beside every step of its walk, on the dotted ground
 * opening a workspace ends on: the strategy it serves, the gaps and
 * indicators behind it, its problems, and the groups and service it
 * reaches, joined as the definition joins them. Three ways to work it:
 * Select a node to see where it is defined; Connect two nodes by dragging
 * from one to the other, where only what the engine allows takes the
 * drop and the rest say why; Move the view by dragging it, and zoom.
 */
export function ProjectMap({
  id,
  spec,
  updateSpec,
  onSelect,
}: {
  id: string;
  spec: ProjectSpec;
  updateSpec: (fn: (s: ProjectSpec) => ProjectSpec) => void;
  onSelect?: (node: MapNode) => void;
}) {
  const client = useClient();
  const queryClient = useQueryClient();
  const graph = useQuery({ queryKey: ["graph", `Project/${id}`], queryFn: () => client.graph(`Project/${id}`) });
  const [mode, setMode] = useState<Mode>("select");
  const [selected, setSelected] = useState<string | null>(null);

  // The nodes: records near the project, and its own problems.
  const { nodes, edges } = useMemo(() => {
    const problems = spec.summary.problems ?? [];
    // What the project names, and what those name in turn, followed
    // outward only: the outcomes it serves and the aims above them, its
    // gaps and what they close into and fall on, its indicators, its
    // groups and its service. Following links inward would bring in every
    // sibling, and the map would be the whole workspace.
    const all = graph.data?.nodes ?? [];
    const forward = new Map<string, string[]>();
    for (const e of graph.data?.edges ?? []) {
      const k = `${e.from.kind}/${e.from.id}`;
      forward.set(k, [...(forward.get(k) ?? []), `${e.to.kind}/${e.to.id}`]);
    }
    // A problem's gaps are held inside the project, so the graph has no
    // edge for them: they start the walk too.
    const cited = problems.flatMap((p) => (p.gaps ?? []).map((c) => `Gap/${c.gap}`));
    const keep = new Set<string>([`Project/${id}`, ...cited]);
    const queue = [`Project/${id}`, ...cited];
    while (queue.length > 0) {
      const k = queue.shift() as string;
      for (const t of forward.get(k) ?? []) {
        if (keep.has(t) || !KEEP.has(t.split("/")[0])) continue;
        keep.add(t);
        queue.push(t);
      }
    }
    const near = all.filter((n) => keep.has(`${n.kind}/${n.id}`));
    const base: MapNode[] = [
      ...near.map((n) => ({ key: `${n.kind}/${n.id}`, kind: n.kind, id: n.id, name: n.name, level: n.level })),
      ...problems.map((p, i) => ({
        key: `Problem/${p.id ?? `#${i}`}`,
        kind: "Problem",
        id: p.id ?? `#${i}`,
        problem: p.id ?? `#${i}`,
        name: p.problem?.situation?.trim() || copy.projects.aim.problemBadge(i + 1),
      })),
    ];
    if (!base.some((n) => n.kind === "Project")) base.push({ key: `Project/${id}`, kind: "Project", id, name: id });
    const rows = new Map<number, MapNode[]>();
    for (const n of base) {
      const r = ROW[n.kind === "Goal" ? (n.level ?? "outcome") : n.kind] ?? 6;
      rows.set(r, [...(rows.get(r) ?? []), n]);
    }
    const widest = Math.max(1, ...[...rows.values()].map((l) => l.length));
    const placed = new Map<string, Placed>();
    // Rows with nothing in them close up, so the chain stays compact.
    [...rows.keys()].sort((a, b) => a - b).forEach((r, line) => {
      const list = rows.get(r) ?? [];
      const left = ((widest - list.length) * (W + GAP_X)) / 2;
      list.forEach((n, i) => placed.set(n.key, { ...n, x: left + i * (W + GAP_X), y: line * (H + GAP_Y) }));
    });
    const out: Edge[] = [];
    const add = (a?: Placed, b?: Placed) => {
      if (a && b && a.key !== b.key) out.push({ from: a, to: b, link: linkFor(a, b) });
    };
    for (const e of graph.data?.edges ?? []) {
      // The project's gaps and groups are its problems' links.
      if (e.from.kind === "Project" && (e.to.kind === "Gap" || e.to.kind === "BeneficiaryGroup")) continue;
      add(placed.get(`${e.from.kind}/${e.from.id}`), placed.get(`${e.to.kind}/${e.to.id}`));
    }
    problems.forEach((p, i) => {
      const pk = `Problem/${p.id ?? `#${i}`}`;
      add(placed.get(`Project/${id}`), placed.get(pk));
      for (const c of p.gaps ?? []) add(placed.get(pk), placed.get(`Gap/${c.gap}`));
      for (const g of p.groups ?? []) add(placed.get(pk), placed.get(`BeneficiaryGroup/${g}`));
    });
    return { nodes: [...placed.values()], edges: out };
  }, [graph.data, spec, id]);

  // The view: pan and zoom, fitted to the map when it first draws.
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 24, y: 24, k: 0.8 });
  const fitted = useRef(false);
  const fit = useCallback(() => {
    const el = box.current;
    if (!el || nodes.length === 0) return;
    const w = Math.max(...nodes.map((n) => n.x + W)) + 24;
    const h = Math.max(...nodes.map((n) => n.y + H)) + 24;
    // Readable first: never smaller than the text can be read at; a map
    // larger than the pane is moved, not shrunk to nothing.
    const k = Math.min(1.1, Math.max(0.7, Math.min(el.clientWidth / w, el.clientHeight / h)));
    setView({ k, x: (el.clientWidth - w * k) / 2 + 12 * k, y: (el.clientHeight - h * k) / 2 + 12 * k });
  }, [nodes]);
  useEffect(() => {
    if (!fitted.current && nodes.length > 0) {
      fitted.current = true;
      fit();
    }
  }, [nodes, fit]);

  // Drawing a link: what it starts from, where the pointer is, and what
  // the engine says each other node may be.
  const [drawing, setDrawing] = useState<{ from: Placed; at: { x: number; y: number } } | null>(null);
  const starts = drawing ? linksFrom(drawing.from) : [];
  const offers = useQueries({
    queries: starts.map((s) => ({
      queryKey: ["link-candidates", s.link, drawing?.from.kind === "Problem" ? id : drawing?.from.id, drawing?.from.problem],
      queryFn: () => client.linkCandidates(s.link, drawing!.from.kind === "Problem" || drawing!.from.kind === "Project" ? id : drawing!.from.id, drawing!.from.problem),
    })),
  });
  const verdict = new Map<string, LinkCandidate>();
  offers.forEach((q, i) => {
    for (const c of q.data ?? []) if (c.kind === starts[i].target) verdict.set(`${c.kind}/${c.id}`, c);
  });
  const problemIndex = (key: string) => {
    const list = spec.summary.problems ?? [];
    if (key.startsWith("#")) return Number(key.slice(1));
    return list.findIndex((p) => p.id === key);
  };
  async function link(from: Placed, to: Placed, on: boolean) {
    const kind = linkFor(from, to);
    if (!kind) return;
    await setLink(client, updateSpec, problemIndex, kind, from, to, on);
    // Everything that shows the records it changed reads them again.
    void queryClient.invalidateQueries({ queryKey: ["graph"] });
    void queryClient.invalidateQueries({ queryKey: ["link-candidates"] });
    void queryClient.invalidateQueries({ queryKey: ["manifests"] });
    void queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].endsWith("-checks") });
  }

  const toWorld = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  };
  const panFrom = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  function onBackgroundDown(e: React.PointerEvent) {
    if (mode === "connect" && !(e.target as HTMLElement).closest("[data-map-node]")) return;
    if (mode === "move" || !(e.target as HTMLElement).closest("[data-map-node]")) {
      panFrom.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }
  function onMove(e: React.PointerEvent) {
    if (drawing) setDrawing({ ...drawing, at: toWorld(e.clientX, e.clientY) });
    else if (panFrom.current) setView((v) => ({ ...v, x: panFrom.current!.vx + e.clientX - panFrom.current!.x, y: panFrom.current!.vy + e.clientY - panFrom.current!.y }));
  }
  function onUp(e: React.PointerEvent) {
    panFrom.current = null;
    if (!drawing) return;
    const el = document.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>("[data-map-node]");
    const to = el ? nodes.find((n) => n.key === el.dataset.mapNode) : undefined;
    const v = to ? verdict.get(to.key) : undefined;
    if (to && v?.allowed) void link(drawing.from, to, true);
    setDrawing(null);
  }
  function onWheel(e: React.WheelEvent) {
    const r = box.current!.getBoundingClientRect();
    const k = Math.min(2, Math.max(0.25, view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    setView({ k, x: px - ((px - view.x) * k) / view.k, y: py - ((py - view.y) * k) / view.k });
  }
  const zoom = (f: number) => setView((v) => ({ ...v, k: Math.min(2, Math.max(0.25, v.k * f)) }));

  const sel = nodes.find((n) => n.key === selected);

  return (
    <section className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10" aria-label={mc.label} data-cartograph-region="project-map">
      <div className="flex flex-wrap items-center gap-1 border-b bg-card px-2 py-1.5">
        <div role="radiogroup" aria-label={mc.modes} className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          {(
            [
              ["select", MousePointer2, mc.select, mc.selectHint],
              ["connect", Link2, mc.connect, mc.connectHint],
              ["move", Hand, mc.move, mc.moveHint],
            ] as const
          ).map(([m, Icon, label, hint]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              title={hint}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors duration-150 ${mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-map-mode={m}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <span className="ml-1 hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:inline">
          {mode === "select" ? mc.selectHint : mode === "connect" ? mc.connectHint : mc.moveHint}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => zoom(0.85)} aria-label={mc.zoomOut} title={mc.zoomOut}>
            <Minus />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => zoom(1.15)} aria-label={mc.zoomIn} title={mc.zoomIn}>
            <Plus />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={fit} aria-label={mc.fit} title={mc.fit}>
            <Maximize />
          </Button>
        </div>
      </div>

      <div
        ref={box}
        className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden bg-background bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_12%,transparent)_1px,transparent_1px)] [background-size:24px_24px] ${mode === "move" ? "cursor-grab" : ""}`}
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={onWheel}
        data-slot="map-ground"
      >
        {graph.isLoading ? <p className="p-4 text-sm text-muted-foreground">{mc.loading}</p> : null}
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1} aria-hidden="true">
            {edges.map((ed) => {
              // Drawn from the upper node's foot to the lower one's head,
              // whichever way the record holds it; along a row, side to
              // side.
              const [u, l] = ed.from.y <= ed.to.y ? [ed.from, ed.to] : [ed.to, ed.from];
              const sameRow = u.y === l.y;
              const p = sameRow ? { x: u.x + W, y: u.y + H / 2 } : { x: u.x + W / 2, y: u.y + H };
              const q = sameRow ? { x: l.x, y: l.y + H / 2 } : { x: l.x + W / 2, y: l.y };
              const d = sameRow
                ? `M${p.x},${p.y} L${q.x},${q.y}`
                : `M${p.x},${p.y} C${p.x},${(p.y + q.y) / 2} ${q.x},${(p.y + q.y) / 2} ${q.x},${q.y}`;
              const removable = mode === "select" && ed.link;
              return (
                <g
                  key={`${ed.from.key}>${ed.to.key}`}
                  className={removable ? "pointer-events-auto cursor-pointer" : ""}
                  onClick={removable ? () => void link(ed.from, ed.to, false) : undefined}
                  data-map-edge={`${ed.from.key}>${ed.to.key}`}
                >
                  {removable ? <title>{mc.unlink(ed.from.name, ed.to.name)}</title> : null}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                  <path d={d} fill="none" stroke="var(--color-muted-foreground)" strokeOpacity={0.55} strokeWidth={1.5} />
                </g>
              );
            })}
            {drawing ? (
              <line x1={drawing.from.x + W / 2} y1={drawing.from.y + H / 2} x2={drawing.at.x} y2={drawing.at.y} stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="5 4" />
            ) : null}
          </svg>
          {nodes.map((n) => {
            const Icon = n.kind === "Problem" ? null : kindIcon(n.kind);
            const v = drawing && n.key !== drawing.from.key ? verdict.get(n.key) : undefined;
            const dim = drawing && n.key !== drawing.from.key && !v?.allowed;
            const why = drawing && n.key !== drawing.from.key ? (v ? (v.allowed ? mc.linkTo(n.name) : v.linked ? mc.alreadyLinked : (v.reason ?? "")) : mc.cannotLink) : undefined;
            return (
              <div
                key={n.key}
                data-map-node={n.key}
                data-allowed={v?.allowed ? "true" : undefined}
                role="button"
                tabIndex={0}
                aria-label={why ? `${n.name}: ${why}` : n.name}
                title={why}
                onPointerDown={(e) => {
                  if (mode !== "connect" || linksFrom(n).length === 0) return;
                  e.stopPropagation();
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                  setDrawing({ from: n, at: { x: n.x + W / 2, y: n.y + H / 2 } });
                }}
                onClick={() => {
                  if (mode !== "select") return;
                  setSelected(n.key);
                  onSelect?.(n);
                }}
                className={`absolute flex items-center gap-2 rounded-lg border bg-card px-2.5 text-sm shadow-sm transition-[opacity,box-shadow] duration-150 ${dim ? "opacity-30" : ""} ${v?.allowed ? "ring-2 ring-primary" : ""} ${selected === n.key ? "ring-2 ring-foreground" : ""} ${mode === "connect" && linksFrom(n).length > 0 ? "cursor-crosshair" : "cursor-pointer"}`}
                style={{ left: n.x, top: n.y, width: W, height: H }}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: n.kind === "Problem" ? "var(--color-warning)" : colorOf(n.kind) }} aria-hidden="true" />
                {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
                <span className="line-clamp-2 min-w-0 flex-1 leading-tight">{n.name}</span>
              </div>
            );
          })}
        </div>
        {nodes.length <= 1 && !graph.isLoading ? <p className="absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">{mc.empty}</p> : null}
      </div>
      {sel ? (
        <p className="border-t bg-card px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{sel.name}</span> · {copy.sheets.kindsSingular[sel.kind] ?? mc.kinds[sel.kind] ?? sel.kind}
        </p>
      ) : null}
    </section>
  );
}
