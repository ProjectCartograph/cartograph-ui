import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Maximize2, Minus, Plus, Search, X } from "lucide-react";

import { useClient } from "@/client/context";
import type { Graph, GraphNode } from "@/client/port";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { kindIcon } from "@/components/vocab";
import { copy } from "@/copy";
import { manifestLink } from "@/proposals/links";
import { SHEET_KINDS } from "@/surfaces/sheet/schema";
import { colorOf } from "./kinds";
import { restHere, springs, step, type Body } from "./motion";

const gc = copy.graph;

const keyOf = (r: { kind: string; id: string }) => `${r.kind}/${r.id}`;
const kindName = (kind: string) => gc.kind[kind] ?? kind;

/** What the view draws from: the engine's graph, indexed. */
interface Drawn {
  nodes: GraphNode[];
  index: Map<string, number>;
  edges: { s: number; t: number }[];
  /** Each node's neighbours, either way along an edge. */
  near: number[][];
}

function drawn(g: Graph): Drawn {
  const index = new Map(g.nodes.map((n, i) => [keyOf(n), i]));
  const near: number[][] = g.nodes.map(() => []);
  const edges: Drawn["edges"] = [];
  for (const e of g.edges) {
    const s = index.get(keyOf(e.from));
    const t = index.get(keyOf(e.to));
    if (s === undefined || t === undefined) continue;
    edges.push({ s, t });
    near[s].push(t);
    near[t].push(s);
  }
  return { nodes: g.nodes, index, edges, near };
}

/** The graph's bands, top-down, where the engine's layout stacks them
 * (TAXONOMY.md D28): one per layer, with where it starts and its name. A
 * layout that does not stack them gets none, so no band is mislabelled. */
function bands(nodes: GraphNode[], left: number): { layer: number; y: number; x: number; label: string }[] {
  const by = new Map<number, { min: number; max: number; stage?: string }>();
  for (const n of nodes) {
    if (n.layer === undefined) return [];
    const b = by.get(n.layer) ?? { min: n.y, max: n.y, stage: n.stage };
    b.min = Math.min(b.min, n.y);
    b.max = Math.max(b.max, n.y);
    by.set(n.layer, b);
  }
  const layers = [...by.keys()].sort((a, b) => a - b);
  for (let i = 1; i < layers.length; i++) {
    if (by.get(layers[i - 1])!.max >= by.get(layers[i])!.min) return [];
  }
  return layers.map((layer) => {
    const b = by.get(layer)!;
    const label = layer === 0 ? gc.registers : (copy.newWork.stage[b.stage ?? ""] ?? b.stage ?? "");
    return { layer, y: b.min, x: left - 48, label };
  });
}

function radius(n: GraphNode, degree: number) {
  const base = n.kind === "Goal" && n.level === "goal" ? 11 : 6;
  return base + Math.min(9, Math.sqrt(degree) * 2);
}

/** Where a node opens: its own page, its sheet, or, for a stakeholder map,
 * the work it belongs to. */
function openLink(d: Drawn, i: number): { to: string; params?: Record<string, string> } | undefined {
  const n = d.nodes[i];
  if ((SHEET_KINDS as readonly string[]).includes(n.kind)) return { to: "/sheets/$kind", params: { kind: n.kind } };
  if (n.kind === "StakeholderMap") {
    const work = d.near[i].find((j) => d.nodes[j].kind === "Project" || d.nodes[j].kind === "Programme");
    return work === undefined ? undefined : openLink(d, work);
  }
  if (["Goal", "Project", "Programme", "Operation", "Gap", "KPI"].includes(n.kind)) return manifestLink({ kind: n.kind, manifestId: n.id });
  return undefined;
}

interface View {
  x: number;
  y: number;
  k: number;
}

/**
 * Everything in the workspace as a graph: a node per element, an edge
 * wherever one names another, each placed by the engine, so every
 * interface draws the same graph. The graph is directed and acyclic
 * (TAXONOMY.md D28): the engine stacks it in bands from the top down, the
 * registers first and a band per stage of the order of work, and every
 * arrow points at what a thing names, upwards. Pointing at a node lights what it
 * touches and dims the rest, its edges flowing from what holds a
 * reference to what it names; choosing one keeps lit what the engine
 * says is within the depth asked for, with a card to open it or walk on.
 */
export function GraphView({ graph, focus }: { graph: Graph; focus?: string }) {
  const client = useClient();
  const d = useMemo(() => drawn(graph), [graph]);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View | undefined>(undefined);
  const [hover, setHover] = useState<number | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(focus && d.index.has(focus) ? focus : undefined);
  const [depth, setDepth] = useState("2");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  // The nodes as they move. They rest where the engine placed them; this
  // view only animates the way there and back, and sends nothing.
  const bodies = useRef<Body[]>([]);
  // Where each node rests, the engine's place until a hand moves it, and
  // the springs between them.
  const home = useRef<{ x: number; y: number }[]>([]);
  const links = useRef(springs(d.nodes, d.edges));
  const dragged = useRef(false);
  const [, setFrame] = useState(0);
  const still = useRef(true);
  const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const run = () => {
    if (!still.current || reduced) return;
    still.current = false;
    const frame = () => {
      const moving = step(bodies.current, home.current, links.current);
      setFrame((f) => f + 1);
      if (moving > 0 || bodies.current.some((b) => b.held)) requestAnimationFrame(frame);
      else {
        still.current = true;
        // What a hand moved stays as it settled.
        if (dragged.current) {
          dragged.current = false;
          restHere(bodies.current, home.current, links.current);
        }
      }
    };
    requestAnimationFrame(frame);
  };
  useEffect(() => {
    // The graph unfolds from its middle into the engine's layout.
    home.current = d.nodes.map((n) => ({ x: n.x, y: n.y }));
    links.current = springs(d.nodes, d.edges);
    bodies.current = d.nodes.map((n) => (reduced ? { x: n.x, y: n.y, vx: 0, vy: 0 } : { x: n.x * 0.25, y: n.y * 0.25, vx: 0, vy: 0 }));
    setFrame((f) => f + 1);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  // The engine measures the chosen node's distance to every other.
  const measured = useQuery({
    queryKey: ["graph", selected],
    queryFn: () => client.graph(selected),
    enabled: selected !== undefined,
  });
  const chosen = selected === undefined ? undefined : d.index.get(selected);

  const kinds = useMemo(() => [...new Set(d.nodes.map((n) => n.kind))], [d]);
  const shown = (i: number) => !hidden.has(d.nodes[i].kind);
  const at = (i: number) => bodies.current[i] ?? d.nodes[i];

  // The canvas fills its box, whatever the box does.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 600 });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitTo = (ids: number[]) => {
    if (ids.length === 0) return { x: size.w / 2, y: size.h / 2, k: 1 };
    const xs = ids.map((i) => at(i).x);
    const ys = ids.map((i) => at(i).y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const w = Math.max(Math.max(...xs) - x0, 1);
    const h = Math.max(Math.max(...ys) - y0, 1);
    const pad = 80;
    const k = Math.min(size.w / (w + pad * 2), size.h / (h + pad * 2), 1.4);
    return { k, x: size.w / 2 - (x0 + w / 2) * k, y: size.h / 2 - (y0 + h / 2) * k };
  };
  const fit = () => setView(fitTo(d.nodes.map((_, i) => i).filter(shown)));
  // Fit once the box is known: to the focus and what it touches, or to all.
  useEffect(() => {
    if (view) return;
    setView(chosen !== undefined ? fitTo([chosen, ...d.near[chosen]]) : fitTo(d.nodes.map((_, i) => i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);
  const v = view ?? { x: size.w / 2, y: size.h / 2, k: 0.6 };

  // Zoom about the pointer, with the wheel or a pinch.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setView((old) => {
        const o = old ?? v;
        const k = Math.min(4, Math.max(0.15, o.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: px - ((px - o.x) / o.k) * k, y: py - ((py - o.y) / o.k) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });
  const zoom = (by: number) =>
    setView((old) => {
      const o = old ?? v;
      const k = Math.min(4, Math.max(0.15, o.k * by));
      return { k, x: size.w / 2 - ((size.w / 2 - o.x) / o.k) * k, y: size.h / 2 - ((size.h / 2 - o.y) / o.k) * k };
    });

  // Dragging the background pans; dragging a node moves it on this
  // screen; a press that does not move chooses it.
  const drag = useRef<{ node?: number; x: number; y: number; moved: boolean; view: View } | undefined>(undefined);
  const onDown = (e: ReactPointerEvent, node?: number) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { node, x: e.clientX, y: e.clientY, moved: false, view: v };
  };
  const onMove = (e: ReactPointerEvent) => {
    const dr = drag.current;
    if (!dr) return;
    const dx = e.clientX - dr.x;
    const dy = e.clientY - dr.y;
    if (!dr.moved && Math.hypot(dx, dy) < 4) return;
    dr.moved = true;
    if (dr.node === undefined) {
      setView({ ...dr.view, x: dr.view.x + dx, y: dr.view.y + dy });
      return;
    }
    const r = svg.current!.getBoundingClientRect();
    const b = bodies.current[dr.node];
    if (!b) return;
    b.held = true;
    b.pinned = false;
    dragged.current = true;
    b.x = (e.clientX - r.left - v.x) / v.k;
    b.y = (e.clientY - r.top - v.y) / v.k;
    if (reduced) setFrame((f) => f + 1);
    run();
  };
  const onUp = () => {
    const dr = drag.current;
    drag.current = undefined;
    if (dr?.node !== undefined && bodies.current[dr.node]) {
      const b = bodies.current[dr.node];
      b.held = false;
      // Dropped, it stays where it was put.
      if (dr.moved) {
        b.pinned = true;
        home.current[dr.node] = { x: b.x, y: b.y };
      }
      run();
    }
    if (!dr || dr.moved) return;
    if (dr.node === undefined) setSelected(undefined);
    else {
      const key = keyOf(d.nodes[dr.node]);
      setSelected((s) => (s === key ? undefined : key));
    }
  };

  // What is lit: what the pointer is on and the edges it has, else what
  // the engine says is within the depth asked for of the chosen one.
  const lit = useMemo(() => {
    if (hover !== undefined) return new Set([hover, ...d.near[hover]]);
    if (chosen === undefined) return undefined;
    const far = depth === "all" ? Infinity : Number(depth);
    const nodes = measured.data?.nodes;
    if (!nodes) return new Set([chosen, ...d.near[chosen]]);
    const out = new Set<number>();
    for (const n of nodes) {
      if (n.distance !== undefined && n.distance <= far) {
        const i = d.index.get(keyOf(n));
        if (i !== undefined) out.add(i);
      }
    }
    return out;
  }, [d, hover, chosen, depth, measured.data]);
  const centre = hover ?? chosen;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return d.nodes
      .map((n, i) => ({ n, i }))
      .filter(({ n, i }) => shown(i) && n.name.toLowerCase().includes(q))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, query, hidden]);
  const choose = (i: number) => {
    setSelected(keyOf(d.nodes[i]));
    setQuery("");
    const p = at(i);
    setView((old) => {
      const o = old ?? v;
      const k = Math.max(o.k, 1);
      return { k, x: size.w / 2 - p.x * k, y: size.h / 2 - p.y * k };
    });
  };

  const labelAll = v.k >= 0.9;
  const banded = useMemo(() => bands(d.nodes, Math.min(...d.nodes.map((n) => n.x))), [d]);
  return (
    <div className="relative h-full min-h-[480px] overflow-hidden rounded-lg border bg-background" data-cartograph-region="graph">
      <svg
        ref={svg}
        className="size-full touch-none select-none"
        role="group"
        aria-label={gc.title}
        onPointerDown={(e) => onDown(e)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          {/* An edge ends in an arrow at what it names, which comes before
              it in the order of work: the graph is directed and acyclic. */}
          <marker id="cartograph-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
          </marker>
        </defs>
        <g transform={`translate(${v.x},${v.y}) scale(${v.k})`}>
          <g data-slot="graph-bands" aria-hidden>
            {banded.map((b) => (
              <text
                key={b.layer}
                x={b.x}
                y={b.y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={11 / Math.max(v.k, 0.6)}
                data-band={b.layer}
              >
                {b.label}
              </text>
            ))}
          </g>
          <g data-slot="graph-edges">
            {d.edges.map((e, i) => {
              if (!shown(e.s) || !shown(e.t)) return null;
              const a = at(e.s);
              const b = at(e.t);
              const on = lit ? lit.has(e.s) && lit.has(e.t) && (hover === undefined || e.s === hover || e.t === hover) : false;
              // Stop at the named node's rim, so the arrow shows.
              const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
              const rim = radius(d.nodes[e.t], d.near[e.t].length) + 2;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x - ((b.x - a.x) / len) * rim}
                  y2={b.y - ((b.y - a.y) / len) * rim}
                  markerEnd="url(#cartograph-graph-arrow)"
                  data-lit={on || undefined}
                  className={on ? "cartograph-graph-flow" : undefined}
                  stroke={on ? colorOf(d.nodes[centre === e.t ? e.s : e.t].kind) : "currentColor"}
                  strokeOpacity={on ? 0.9 : lit ? 0.05 : 0.18}
                  strokeWidth={on ? 1.8 : 1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
          <g data-slot="graph-nodes">
            {d.nodes.map((n, i) => {
              if (!shown(i)) return null;
              const r = radius(n, d.near[i].length);
              const p = at(i);
              const dim = lit !== undefined && !lit.has(i);
              const isCentre = i === centre;
              const Icon = kindIcon(n.kind);
              const label = labelAll || (lit?.has(i) ?? false) || d.near[i].length >= 8;
              return (
                <g
                  key={keyOf(n)}
                  transform={`translate(${p.x},${p.y})`}
                  className="cartograph-graph-node cursor-pointer outline-none"
                  style={{ opacity: dim ? 0.12 : 1 }}
                  data-node={keyOf(n)}
                  data-dim={dim || undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={gc.node(kindName(n.kind), n.name)}
                  aria-pressed={i === chosen}
                  onPointerDown={(e) => onDown(e, i)}
                  onPointerEnter={() => !drag.current && setHover(i)}
                  onPointerLeave={() => setHover((h) => (h === i ? undefined : h))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((h) => (h === i ? undefined : h))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected((s) => (s === keyOf(n) ? undefined : keyOf(n)));
                    }
                  }}
                >
                  {isCentre ? <circle r={r + 6} fill={colorOf(n.kind)} opacity={0.18} className="cartograph-graph-halo" /> : null}
                  <circle r={r} fill={colorOf(n.kind)} stroke="var(--background)" strokeWidth={1.5} />
                  {Icon && r * v.k >= 9 ? <Icon x={-r * 0.6} y={-r * 0.6} width={r * 1.2} height={r * 1.2} color="white" strokeWidth={2.4} aria-hidden /> : null}
                  {label ? (
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      className="fill-foreground"
                      style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3, fontWeight: isCentre ? 600 : 400 }}
                      fontSize={11 / Math.max(v.k, 0.6)}
                    >
                      {n.name.length > 36 ? `${n.name.slice(0, 34)}…` : n.name}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Find, and which kinds to show. */}
      <div className="absolute left-3 top-3 flex w-72 max-w-[calc(100%-1.5rem)] flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) choose(matches[0].i);
              if (e.key === "Escape") setQuery("");
            }}
            aria-label={gc.search}
            placeholder={gc.search}
            className="bg-background/95 pl-8 shadow-sm"
          />
        </div>
        {query.trim() ? (
          <ul className="rounded-md border bg-background/95 p-1 text-sm shadow-md" aria-label={gc.search}>
            {matches.length === 0 ? <li className="px-2 py-1.5 text-muted-foreground">{gc.noMatch}</li> : null}
            {matches.map(({ n, i }) => (
              <li key={keyOf(n)}>
                <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent" onClick={() => choose(i)}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(n.kind) }} />
                  <span className="truncate">{n.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{kindName(n.kind)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-1 rounded-md border bg-background/95 p-1.5 shadow-sm" role="group" aria-label={gc.kinds}>
          {kinds.map((k) => {
            const off = hidden.has(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={!off}
                aria-label={off ? gc.showKind(kindName(k)) : gc.hideKind(kindName(k))}
                title={off ? gc.showKind(kindName(k)) : gc.hideKind(kindName(k))}
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (off) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-opacity ${off ? "opacity-40" : "hover:bg-accent"}`}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: colorOf(k) }} />
                {kindName(k)}
              </button>
            );
          })}
        </div>
      </div>

      {chosen !== undefined ? <NodeCard d={d} i={chosen} depth={depth} setDepth={setDepth} choose={choose} close={() => setSelected(undefined)} /> : null}

      <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-md border bg-background/95 p-1 shadow-sm">
        <Button variant="ghost" size="icon-xs" aria-label={gc.zoomIn} title={gc.zoomIn} onClick={() => zoom(1.3)}>
          <Plus />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={gc.zoomOut} title={gc.zoomOut} onClick={() => zoom(1 / 1.3)}>
          <Minus />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={gc.fit} title={gc.fit} onClick={fit}>
          <Maximize2 />
        </Button>
      </div>
    </div>
  );
}

/** The chosen node: what it is, where it opens, and what it connects to,
 * each a step further. */
function NodeCard({
  d,
  i,
  depth,
  setDepth,
  choose,
  close,
}: {
  d: Drawn;
  i: number;
  depth: string;
  setDepth: (depth: string) => void;
  choose: (i: number) => void;
  close: () => void;
}) {
  const n = d.nodes[i];
  const link = openLink(d, i);
  const names = d.edges.filter((e) => e.s === i).map((e) => e.t);
  const namedBy = d.edges.filter((e) => e.t === i).map((e) => e.s);
  const list = (title: string, ids: number[], Icon: typeof ArrowRight) =>
    ids.length === 0 ? null : (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <ul className="flex flex-col">
          {ids.map((j) => (
            <li key={j}>
              <button type="button" className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-accent" onClick={() => choose(j)}>
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(d.nodes[j].kind) }} />
                <span className="truncate">{d.nodes[j].name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{kindName(d.nodes[j].kind)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  const level = n.kind === "Goal" && n.level ? gc.level[n.level] : undefined;
  const degree = d.near[i].length;
  return (
    <aside
      className="absolute right-3 top-3 flex max-h-[calc(100%-5rem)] w-80 max-w-[calc(100%-1.5rem)] flex-col gap-3 overflow-y-auto rounded-lg border bg-background/95 p-3 shadow-lg animate-in fade-in slide-in-from-right-4 duration-200"
      aria-label={n.name}
      data-slot="graph-card"
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: colorOf(n.kind) }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{level ?? kindName(n.kind)}</p>
          <h2 className="font-semibold leading-snug">{n.name}</h2>
          <p className="text-xs text-muted-foreground">{degree === 0 ? gc.noConnections : gc.connections(degree)}</p>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label={gc.clear} onClick={close}>
          <X />
        </Button>
      </div>
      {link ? (
        <Button size="sm" asChild>
          <Link to={link.to as never} params={link.params as never}>
            {gc.open}
          </Link>
        </Button>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{gc.depth}</p>
        <ToggleGroup type="single" size="sm" variant="outline" value={depth} onValueChange={(next) => next && setDepth(next)} aria-label={gc.depth}>
          {["1", "2", "3", "all"].map((step) => (
            <ToggleGroupItem key={step} value={step} className="text-xs">
              {gc.depths[step]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {list(gc.pointsTo, names, ArrowRight)}
      {list(gc.pointedAtBy, namedBy, ArrowLeft)}
    </aside>
  );
}
