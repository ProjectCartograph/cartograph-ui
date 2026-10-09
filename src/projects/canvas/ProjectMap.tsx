import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Blocks, CalendarClock, CalendarX, Hand, Link2, ListTree, Maximize, Minus, MousePointer2, Plus, RefreshCcw, Share2, Timer, TriangleAlert } from "lucide-react";

import { useClient } from "@/client/context";
import type { LinkCandidate, WaitsNode } from "@/client/port";
import { Button } from "@/components/ui/button";
import { kindIcon } from "@/components/vocab";
import { copy } from "@/copy";
import { colorOf } from "@/graph/kinds";
import type { ProjectSpec } from "../types";
import { useComponentGraph } from "../components/ComponentsTable";
import { dependencyRows, type Tone, type WorkNode } from "./dependencies";
import { linkFor, linksFrom, setLink, type MapNode } from "./links";
import { timingWords, waitsMap } from "./waits";
import { reachKey } from "../WhatHappened";

const mc = copy.projectMap;
const cc = copy.projects.components;

type Mode = "select" | "connect" | "move";
/** What the map shows: the project's results chain, or the projects and
 * programmes it depends on and that depend on it. */
type Lens = "chain" | "deps" | "waits";

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
  marks?: WorkNode["marks"];
  /** A dated item, on the waits view. */
  waits?: WaitsNode;
}

interface Edge {
  from: Placed;
  to: Placed;
  link?: ReturnType<typeof linkFor>;
  tone?: Tone;
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
  const [lens, setLens] = useState<Lens>("chain");
  const [selected, setSelected] = useState<string | null>(null);
  const components = useComponentGraph();

  // The dependency map: every project and programme, each line running
  // down from the work to what it depends on (TAXONOMY.md D46).
  const depsMap = useMemo(() => {
    if (!components.data) return { nodes: [] as Placed[], edges: [] as Edge[], lines: [] as { row: number; y: number; label?: string }[] };
    const { rows, tones, legacy, loose } = dependencyRows(components.data);
    // Each row ordered beside what it links to, swept down and up.
    const pos = new Map<string, number>();
    rows.forEach((list) => list.forEach((n, i) => pos.set(n.key, i)));
    const ties = new Map<string, string[]>();
    for (const e of components.data.edges) {
      const a = `${e.from.kind}/${e.from.id}`;
      const b = `${e.to.kind}/${e.to.id}`;
      ties.set(a, [...(ties.get(a) ?? []), b]);
      ties.set(b, [...(ties.get(b) ?? []), a]);
    }
    const sweep = (order: WorkNode[][]) => {
      for (const list of order) {
        const score = (n: WorkNode) => {
          const near = (ties.get(n.key) ?? []).filter((k) => pos.has(k) && !list.some((m) => m.key === k));
          return near.length ? near.reduce((t, k) => t + (pos.get(k) ?? 0), 0) / near.length : (pos.get(n.key) ?? 0);
        };
        list.sort((a, b) => score(a) - score(b));
        list.forEach((n, i) => pos.set(n.key, i - (list.length - 1) / 2));
      }
    };
    for (let i = 0; i < 4; i++) {
      sweep(rows);
      sweep([...rows].reverse());
    }
    const widest = Math.max(1, ...rows.map((l) => l.length));
    const placed = new Map<string, Placed>();
    rows.forEach((list, line) => {
      const left = ((widest - list.length) * (W + GAP_X)) / 2;
      list.forEach((n, i) => placed.set(n.key, { ...n, x: left + i * (W + GAP_X), y: line * (H + GAP_Y) }));
    });
    const out: Edge[] = [];
    for (const e of components.data.edges) {
      const a = placed.get(`${e.from.kind}/${e.from.id}`);
      const b = placed.get(`${e.to.kind}/${e.to.id}`);
      if (!a || !b) continue;
      const k = `${a.key}>${b.key}`;
      // A link an older definition recorded on the component is changed
      // there, not by clicking it here.
      out.push({ from: a, to: b, link: legacy.has(k) ? undefined : linkFor(a, b), tone: tones.get(k) ?? "plain" });
    }
    // The last row, when it holds work with no link yet, says so.
    const lines: { row: number; y: number; label?: string }[] = loose ? [{ row: -1, y: (rows.length - 1) * (H + GAP_Y), label: mc.notLinked }] : [];
    return { nodes: [...placed.values()], edges: out, lines };
  }, [components.data]);

  // The nodes: records near the project, and its own problems.
  const chainMap = useMemo(() => {
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
    // Who links to whom, either way, to order each row beside its links.
    const linked = new Map<string, Set<string>>();
    const tie = (a: string, b: string) => {
      linked.set(a, (linked.get(a) ?? new Set()).add(b));
      linked.set(b, (linked.get(b) ?? new Set()).add(a));
    };
    for (const e of graph.data?.edges ?? []) tie(`${e.from.kind}/${e.from.id}`, `${e.to.kind}/${e.to.id}`);
    problems.forEach((p, i) => {
      const pk = `Problem/${p.id ?? `#${i}`}`;
      tie(`Project/${id}`, pk);
      for (const c of p.gaps ?? []) tie(pk, `Gap/${c.gap}`);
      for (const g of p.groups ?? []) tie(pk, `BeneficiaryGroup/${g}`);
    });
    // Each row in the order that crosses least: by the average position of
    // what it links to in the rows already placed, swept down and up a few
    // times (the barycentre method).
    const order = [...rows.keys()].sort((a, b) => a - b);
    const pos = new Map<string, number>();
    for (const r of order) (rows.get(r) ?? []).forEach((n, i) => pos.set(n.key, i));
    const sweep = (lines: number[]) => {
      for (const r of lines) {
        const list = rows.get(r) ?? [];
        const score = (n: MapNode) => {
          const near = [...(linked.get(n.key) ?? [])].filter((k) => pos.has(k) && !list.some((m) => m.key === k));
          return near.length ? near.reduce((t, k) => t + (pos.get(k) ?? 0), 0) / near.length : (pos.get(n.key) ?? 0);
        };
        list.sort((a, b) => score(a) - score(b));
        list.forEach((n, i) => pos.set(n.key, i - (list.length - 1) / 2));
      }
    };
    for (let i = 0; i < 4; i++) {
      sweep(order);
      sweep([...order].reverse());
    }
    const widest = Math.max(1, ...[...rows.values()].map((l) => l.length));
    const placed = new Map<string, Placed>();
    // Rows with nothing in them close up, so the chain stays compact.
    order.forEach((r, line) => {
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
    const lines = order.map((r, line) => ({ row: r, y: line * (H + GAP_Y) }));
    return { nodes: [...placed.values()], edges: out, lines };
  }, [graph.data, spec, id]);
  // What the project's dated items wait on, across kinds, as the engine
  // works it out and lays it out (engine TAXONOMY.md D47, D48).
  const waits = useQuery({ queryKey: ["waits", id], queryFn: () => client.waits(id), enabled: lens === "waits" });
  const waitsView = useMemo(() => waitsMap(waits.data), [waits.data]);
  // What a trigger recorded beside the walk reaches (WhatHappened).
  const reached = useQuery<string[]>({ queryKey: ["waits-reach", id], queryFn: () => [], enabled: false, initialData: [] });
  const reachedSet = new Set(reached.data ?? []);
  const { nodes, edges, lines } = lens === "waits" ? (waitsView as { nodes: Placed[]; edges: Edge[]; lines: { row: number; y: number; label?: string }[] }) : lens === "deps" ? depsMap : chainMap;
  // On the waits view a drag joins two of this project's milestones: the
  // one dropped on waits on the one dragged from.
  const ownMilestone = (n: Placed) => lens === "waits" && n.kind === "Project" && n.id === id && !!n.item?.startsWith("milestones/");
  const canDraw = (n: Placed) => (lens === "waits" ? ownMilestone(n) : linksFrom(n, lens).length > 0);
  function waitOn(from: Placed, to: Placed) {
    const before = from.item!.slice("milestones/".length);
    const after = to.item!.slice("milestones/".length);
    updateSpec((s) => ({
      ...s,
      milestones: (s.milestones ?? []).map((m) =>
        m.id !== after || (m.waitsOn ?? []).some((w) => "local" in w.on && w.on.id === before) ? m : { ...m, waitsOn: [...(m.waitsOn ?? []), { on: { local: "milestones", id: before } }] },
      ),
    }));
    void queryClient.invalidateQueries({ queryKey: ["waits", id] });
  }

  // The view: pan and zoom, fitted to the map when it first draws.
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 24, y: 24, k: 0.8 });
  const fitted = useRef(false);
  const fit = useCallback(() => {
    const el = box.current;
    if (!el || nodes.length === 0) return;
    // Room on the left for the row labels.
    const w = Math.max(...nodes.map((n) => n.x + W)) + 24 + 132;
    const h = Math.max(...nodes.map((n) => n.y + H)) + 24;
    // Readable first: never smaller than the text can be read at; a map
    // larger than the pane is moved, not shrunk to nothing.
    const k = Math.min(1.1, Math.max(0.7, Math.min(el.clientWidth / w, el.clientHeight / h)));
    // Centred when it fits; from the top (the strategy) when it is taller
    // than the pane. When wider, centred on this project, which is what the
    // person came to see, rather than on the middle of the map.
    const self = nodes.find((n) => n.kind === "Project" && n.id === id);
    const x = w * k <= el.clientWidth || !self ? (el.clientWidth - w * k) / 2 + 144 * k : el.clientWidth / 2 - (self.x + W / 2) * k;
    setView({ k, x, y: h * k > el.clientHeight ? 12 : (el.clientHeight - h * k) / 2 + 12 * k });
  }, [nodes, id]);
  // Until the person moves the map themselves, it is fitted again whenever
  // the pane changes size: it is laid out before the page settles.
  const moved = useRef(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!moved.current && el.clientWidth > 0) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  // Each view is fitted when it is first shown; declared before the fit
  // below so it runs first.
  useEffect(() => {
    fitted.current = false;
  }, [lens]);
  useEffect(() => {
    const el = box.current;
    if (fitted.current || nodes.length === 0 || !el || el.clientWidth === 0) return;
    fitted.current = true;
    fit();
  }, [nodes, fit]);

  // Drawing a link: what it starts from, where the pointer is, and what
  // the engine says each other node may be.
  const [drawing, setDrawing] = useState<{ from: Placed; at: { x: number; y: number } } | null>(null);
  const starts = drawing && lens !== "waits" ? linksFrom(drawing.from, lens) : [];
  const offers = useQueries({
    queries: starts.map((s) => ({
      queryKey: ["link-candidates", s.link, drawing?.from.kind === "Problem" ? id : drawing?.from.id, drawing?.from.problem],
      queryFn: () => client.linkCandidates(s.link, drawing!.from.kind === "Problem" ? id : drawing!.from.id, drawing!.from.problem),
    })),
  });
  const verdict = new Map<string, LinkCandidate>();
  offers.forEach((q, i) => {
    for (const c of q.data ?? []) if (starts[i].target === "*" || c.kind === starts[i].target) verdict.set(`${c.kind}/${c.id}`, c);
  });
  // On the waits view, any other milestone of this project may wait on the
  // one dragged from, unless it already does.
  if (drawing && lens === "waits") {
    const from = drawing.from.item?.slice("milestones/".length);
    for (const n of nodes) {
      if (!ownMilestone(n) || n.key === drawing.from.key) continue;
      const linked = (spec.milestones ?? []).some((m) => `milestones/${m.id}` === n.item && (m.waitsOn ?? []).some((w) => "local" in w.on && w.on.id === from));
      verdict.set(n.key, { kind: n.kind, id: n.id, name: n.name, allowed: !linked, linked });
    }
  }
  const problemIndex = (key: string) => {
    const list = spec.summary.problems ?? [];
    if (key.startsWith("#")) return Number(key.slice(1));
    return list.findIndex((p) => p.id === key);
  };
  async function link(from: Placed, to: Placed, on: boolean) {
    const kind = linkFor(from, to);
    if (!kind) return;
    await setLink(client, updateSpec, problemIndex, kind, from, to, on, id);
    // Everything that shows the records it changed reads them again.
    void queryClient.invalidateQueries({ queryKey: ["graph"] });
    void queryClient.invalidateQueries({ queryKey: ["components"] });
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
      moved.current = true;
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
    if (to && v?.allowed) {
      if (lens === "waits") waitOn(drawing.from, to);
      else void link(drawing.from, to, true);
    }
    setDrawing(null);
  }
  function onWheel(e: React.WheelEvent) {
    moved.current = true;
    const r = box.current!.getBoundingClientRect();
    const k = Math.min(2, Math.max(0.25, view.k * (e.deltaY < 0 ? 1.1 : 0.9)));
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    setView({ k, x: px - ((px - view.x) * k) / view.k, y: py - ((py - view.y) * k) / view.k });
  }
  const zoom = (f: number) => {
    moved.current = true;
    setView((v) => ({ ...v, k: Math.min(2, Math.max(0.25, v.k * f)) }));
  };

  const sel = nodes.find((n) => n.key === selected);
  // A node in focus, pointed at or selected, brings out its links and its
  // neighbours; the rest step back.
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = drawing ? null : (hovered ?? selected);
  const near = new Set<string>();
  if (focus) {
    near.add(focus);
    for (const ed of edges) {
      if (ed.from.key === focus) near.add(ed.to.key);
      if (ed.to.key === focus) near.add(ed.from.key);
    }
  }

  return (
    <section className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10" aria-label={mc.label} data-cartograph-region="project-map">
      <div className="flex flex-wrap items-center gap-1 border-b bg-card px-2 py-1.5">
        <div role="radiogroup" aria-label={mc.lens} className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          {(
            [
              ["chain", ListTree, mc.chain],
              ["deps", Blocks, mc.deps],
              ["waits", CalendarClock, mc.waitsLens],
            ] as const
          ).map(([l, Icon, label]) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={lens === l}
              aria-label={label}
              title={label}
              onClick={() => setLens(l)}
              className={`flex items-center rounded px-1.5 py-1 transition-colors duration-150 ${lens === l ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-map-lens={l}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
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
          {mode === "select" ? mc.selectHint : mode === "connect" ? (lens === "waits" ? mc.waits.connectHint : mc.connectHint) : mc.moveHint}
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
        {(lens === "waits" ? waits.isLoading : graph.isLoading) ? <p className="p-4 text-sm text-muted-foreground">{mc.loading}</p> : null}
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
              const on = focus && (ed.from.key === focus || ed.to.key === focus);
              const toned = ed.tone === "loop" ? "var(--color-destructive)" : ed.tone === "critical" ? "var(--color-warning)" : undefined;
              return (
                <g
                  key={`${ed.from.key}>${ed.to.key}`}
                  className={removable ? "pointer-events-auto cursor-pointer" : ""}
                  onClick={removable ? () => void link(ed.from, ed.to, false) : undefined}
                  data-map-edge={`${ed.from.key}>${ed.to.key}`}
                >
                  {removable ? <title>{mc.unlink(ed.from.name, ed.to.name)}</title> : null}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                  <path
                    d={d}
                    fill="none"
                    stroke={toned ?? (on ? "var(--color-primary)" : "var(--color-muted-foreground)")}
                    strokeOpacity={focus ? (on ? 0.9 : 0.08) : toned ? 0.85 : 0.3}
                    strokeWidth={on || toned ? 2.25 : 1.25}
                    strokeDasharray={ed.tone === "loop" ? "6 4" : undefined}
                    data-tone={ed.tone}
                  />
                </g>
              );
            })}
            {drawing ? (
              <line x1={drawing.from.x + W / 2} y1={drawing.from.y + H / 2} x2={drawing.at.x} y2={drawing.at.y} stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="5 4" />
            ) : null}
          </svg>
          {/* What each row is, at its left. */}
          {lines.map((l) => (
            <span
              key={l.row}
              className="absolute -translate-x-full pr-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground/70"
              style={{ left: Math.min(...nodes.map((n) => n.x)), top: l.y + H / 2 - 8, width: 120 }}
              aria-hidden="true"
            >
              {("label" in l && typeof l.label === "string" ? l.label : undefined) ?? mc.rows[l.row] ?? ""}
            </span>
          ))}
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
                  if (mode !== "connect" || !canDraw(n)) return;
                  e.stopPropagation();
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                  setDrawing({ from: n, at: { x: n.x + W / 2, y: n.y + H / 2 } });
                }}
                onPointerEnter={() => setHovered(n.key)}
                onPointerLeave={() => setHovered((h) => (h === n.key ? null : h))}
                onClick={() => {
                  if (mode !== "select") return;
                  setSelected(n.key);
                  onSelect?.(n);
                }}
                className={`absolute flex items-center gap-2 rounded-lg border bg-card px-2.5 text-sm shadow-sm transition-[opacity,box-shadow] duration-150 ${dim || (focus && !near.has(n.key)) ? "opacity-30" : ""} ${v?.allowed ? "ring-2 ring-primary" : ""} ${selected === n.key ? "ring-2 ring-foreground" : ""} ${mode === "connect" && canDraw(n) ? "cursor-crosshair" : "cursor-pointer"} ${lens === "deps" && n.kind === "Project" && n.id === id ? "border-foreground" : ""} ${n.waits?.conflict || n.waits?.late ? "border-destructive" : ""} ${n.waits && reachedSet.has(reachKey(n.waits)) ? "ring-2 ring-warning" : ""}`}
                style={{ left: n.x, top: n.y, width: W, height: H }}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: n.kind === "Problem" ? "var(--color-warning)" : colorOf(n.kind) }} aria-hidden="true" />
                {Icon ? <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
                {n.waits ? (
                  <span className="flex min-w-0 flex-1 flex-col leading-tight" data-waits-kind={n.waits.kind}>
                    <span className="truncate">{n.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{timingWords(n.waits) || mc.waits.kinds[n.waits.kind]}</span>
                  </span>
                ) : (
                  <span className="line-clamp-2 min-w-0 flex-1 leading-tight">{n.name}</span>
                )}
                {n.waits ? <WaitsMarks n={n.waits} /> : null}
                {n.marks ? (
                  <span className="flex shrink-0 flex-col items-center gap-0.5">
                    {n.marks.inLoop ? <RefreshCcw className="size-3.5 text-destructive" role="img" aria-label={cc.inLoop} data-mark="loop"><title>{cc.inLoop}</title></RefreshCcw> : null}
                    {n.marks.critical ? <Timer className="size-3.5 text-warning" role="img" aria-label={cc.critical} data-mark="critical"><title>{cc.critical}</title></Timer> : null}
                    {n.marks.mostDependedOn ? <Share2 className="size-3.5 text-primary" role="img" aria-label={cc.mostDependedOn} data-mark="shared"><title>{cc.mostDependedOn}</title></Share2> : null}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {lens === "waits" ? (
          nodes.length === 0 && !waits.isLoading ? <p className="absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">{mc.waits.empty}</p> : null
        ) : nodes.length <= 1 && !graph.isLoading ? (
          <p className="absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">{mc.empty}</p>
        ) : null}
      </div>
      {lens === "deps" && components.data ? <DependencyFacts graph={components.data} /> : null}
      {sel ? (
        <p className="border-t bg-card px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">{sel.name}</span> · {copy.sheets.kindsSingular[sel.kind] ?? mc.kinds[sel.kind] ?? sel.kind}
        </p>
      ) : null}
    </section>
  );
}

/** What the dependency map shows, said in words under it: each loop in
 * order, and the critical path with its length. */
function DependencyFacts({ graph }: { graph: NonNullable<ReturnType<typeof useComponentGraph>["data"]> }) {
  const name = new Map(graph.nodes.map((n) => [`${n.kind}/${n.id}`, n.name]));
  const say = (list: { kind: string; id: string }[]) => list.map((r) => name.get(`${r.kind}/${r.id}`) ?? r.id).join(` ${mc.dependsOnWord} `);
  return (
    <ul className="flex flex-col gap-1 border-t bg-card px-3 py-2 text-xs" data-slot="dependency-facts" aria-live="polite">
      {graph.loops.map((loop, i) => (
        <li key={i} className="flex items-start gap-1.5 text-destructive" data-fact="loop">
          <RefreshCcw className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {mc.loopFact(say(loop))}
        </li>
      ))}
      {graph.criticalPath.length > 1 ? (
        <li className="flex items-start gap-1.5 text-muted-foreground" data-fact="critical">
          <Timer className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          {mc.criticalFact(say(graph.criticalPath), graph.criticalMonths)}
        </li>
      ) : null}
      {graph.loops.length === 0 && graph.criticalPath.length <= 1 ? (
        <li className="text-muted-foreground">{graph.edges.length === 0 ? mc.noDependencies : mc.noCriticalPath}</li>
      ) : null}
    </ul>
  );
}

/** What the engine marks on a dated item: the chain that decides the last
 * date, the risks that could move it, and what does not fit or is late. */
function WaitsMarks({ n }: { n: WaitsNode }) {
  const wm = mc.waits;
  return (
    <span className="flex shrink-0 flex-col items-center gap-0.5">
      {n.critical ? (
        <Timer className="size-3.5 text-warning" role="img" aria-label={wm.critical} data-mark="critical">
          <title>{wm.critical}</title>
        </Timer>
      ) : null}
      {n.risks?.length ? (
        <TriangleAlert className="size-3.5 text-warning" role="img" aria-label={wm.movedBy(n.risks.join("; "))} data-mark="risk">
          <title>{wm.movedBy(n.risks.join("; "))}</title>
        </TriangleAlert>
      ) : null}
      {n.conflict || n.late ? (
        <CalendarX className="size-3.5 text-destructive" role="img" aria-label={n.conflict ? wm.conflict : wm.late} data-mark={n.conflict ? "conflict" : "late"}>
          <title>{n.conflict ? wm.conflict : wm.late}</title>
        </CalendarX>
      ) : null}
    </span>
  );
}
