import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CircleAlert, Plus, TriangleAlert, Users } from "lucide-react";
import { parseDocument } from "yaml";

import { useClient } from "@/client/context";
import type { LinkCandidate, LinkKind } from "@/client/port";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { ProblemLine } from "./types";

const mc = copy.projects.aim.map;

interface GapItem {
  id: string;
  name: string;
  spec?: { affects?: string[] };
}

/** Every gap with whom it affects, in one request. */
function useGaps() {
  const client = useClient();
  return useQuery({
    queryKey: ["manifests", "Gap", "expanded"],
    queryFn: async () => (await client.list("Gap", { expand: "spec" })) as GapItem[],
  });
}

/** A link being drawn: what it starts from, and where the pointer is
 * (none while it was started by a click, for the keyboard). */
interface Drawing {
  link: LinkKind;
  from: string;
  /** The node it starts from, by its data-node key. */
  node: string;
  at?: { x: number; y: number };
}

/** An edge on the map: two nodes and how to remove what joins them. */
interface Edge {
  key: string;
  from: string;
  to: string;
  dashed?: boolean;
  remove: () => void;
  label: string;
}

/**
 * The problem as a map you draw on: the gaps it is related to, the
 * problem, and the groups it affects, joined by edges. Drag from a node's
 * handle to another node to link them, or click the handle and then the
 * node; click an edge to remove it. While a link is drawn, every record it
 * could reach is shown: those it may join take it, the rest are dimmed and
 * say why (the engine's rules, engine docs/UI_CONTRACT.md "Drawing a
 * link"). A problem and its gaps must be about the same people (engine
 * TAXONOMY.md D45), so a break is marked on its node with what to do.
 */
export function ProblemMap({
  line,
  groupNames,
  onAddGroup,
  onChange,
  project,
  problem,
}: {
  line: ProblemLine;
  groupNames: Map<string, string>;
  onAddGroup: (group: string) => void;
  onChange: (patch: Partial<ProblemLine>) => void;
  /** The project the problem belongs to; without one, nothing is drawn. */
  project?: string;
  /** The problem's id, or "#n" for its position. */
  problem: string;
}) {
  const client = useClient();
  const queryClient = useQueryClient();
  const { data: gaps } = useGaps();
  const { data: groupRefs } = useReferenceOptions("BeneficiaryGroup");
  const nameOf = (g: string) => groupNames.get(g) ?? groupRefs?.names.get(g) ?? g;
  const groups = line.groups ?? [];
  const cited = (line.gaps ?? []).map((c) => gaps?.find((g) => g.id === c.gap) ?? { id: c.gap, name: c.gap });
  const affected = new Set(cited.flatMap((g) => g.spec?.affects ?? []));
  const knows = cited.some((g) => (g.spec?.affects ?? []).length > 0);
  const gapState = (g: GapItem) => {
    const a = g.spec?.affects ?? [];
    if (a.length === 0) return "unknown" as const;
    return groups.length === 0 || a.some((x) => groups.includes(x)) ? ("ok" as const) : ("outside" as const);
  };
  const groupOk = (g: string) => !knows || affected.has(g);
  const suggest = [...affected].filter((g) => !groups.includes(g));

  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const candidates = useQuery({
    queryKey: ["link-candidates", drawing?.link, drawing?.from, project, problem],
    queryFn: () => client.linkCandidates(drawing!.link, drawing!.from, drawing!.link.startsWith("problem-") ? problem : undefined),
    enabled: Boolean(drawing && project),
  });

  // What a gap affects, saved on the gap in the change set.
  const affect = useMutation({
    mutationFn: async ({ gap, add, remove }: { gap: string; add?: string[]; remove?: string }) => {
      const view = await client.get("Gap", gap);
      const doc = parseDocument(view.yaml);
      const now = ((doc.getIn(["spec", "affects"]) as { toJSON(): string[] } | undefined)?.toJSON() ?? []).filter((g) => g !== remove);
      const next = [...new Set([...now, ...(add ?? [])])];
      if (next.length > 0) doc.setIn(["spec", "affects"], next);
      else doc.deleteIn(["spec", "affects"]);
      await client.saveWorking("Gap", gap, doc.toString());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["manifests", "Gap"] });
      void queryClient.invalidateQueries({ queryKey: ["link-candidates"] });
    },
  });

  function connect(drawn: Drawing, to: string) {
    if (drawn.link === "problem-gap") onChange({ gaps: [...(line.gaps ?? []), { gap: to }] });
    else if (drawn.link === "problem-group") onAddGroup(to);
    else if (drawn.link === "gap-group") affect.mutate({ gap: drawn.from, add: [to] });
    void queryClient.invalidateQueries({ queryKey: ["link-candidates"] });
  }

  // The nodes' places, for the edges: measured after every render that
  // could move them.
  const box = useRef<HTMLDivElement>(null);
  const [places, setPlaces] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const measure = useCallback(() => {
    const root = box.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next: typeof places = {};
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-node]"))) {
      const r = el.getBoundingClientRect();
      next[el.dataset.node as string] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    }
    setPlaces((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);
  useLayoutEffect(measure);
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const watch = new ResizeObserver(measure);
    watch.observe(root);
    return () => watch.disconnect();
  }, [measure]);
  // Escape lets go of a link being drawn.
  useEffect(() => {
    if (!drawing) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDrawing(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [drawing]);

  function start(e: React.PointerEvent, link: LinkKind, from: string, node: string) {
    if (!project) return;
    e.preventDefault();
    const base = box.current!.getBoundingClientRect();
    setDrawing({ link, from, node, at: { x: e.clientX - base.left, y: e.clientY - base.top } });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing?.at) return;
    const base = box.current!.getBoundingClientRect();
    setDrawing({ ...drawing, at: { x: e.clientX - base.left, y: e.clientY - base.top } });
  }
  function end(e: React.PointerEvent) {
    if (!drawing) return;
    const target = document.elementFromPoint?.(e.clientX, e.clientY)?.closest<HTMLElement>("[data-drop]");
    const moved = drawing.at && places[drawing.node] && Math.hypot(drawing.at.x - centre(places[drawing.node]).x, drawing.at.y - centre(places[drawing.node]).y) > 12;
    if (target?.dataset.allowed === "true") {
      connect(drawing, target.dataset.drop as string);
      setDrawing(null);
    } else if (moved) setDrawing(null);
    // A click without a drag: the link waits for a node to be clicked.
    else setDrawing({ ...drawing, at: undefined });
  }

  const offered = (side: "gap" | "group") =>
    drawing && ((side === "gap" && drawing.link === "problem-gap") || (side === "group" && drawing.link !== "problem-gap")) ? (candidates.data ?? []) : null;
  const gapOffer = offered("gap");
  const groupOffer = offered("group");

  const edges: Edge[] = [
    ...cited.map((g) => ({
      key: `gp-${g.id}`,
      from: `gap:${g.id}`,
      to: "problem",
      label: mc.unlink(g.name),
      remove: () => onChange({ gaps: (line.gaps ?? []).filter((c) => c.gap !== g.id) }),
    })),
    ...groups.map((g) => ({
      key: `pg-${g}`,
      from: "problem",
      to: `group:${g}`,
      label: mc.unlink(nameOf(g)),
      remove: () => onChange({ groups: groups.filter((x) => x !== g) }),
    })),
    ...cited.flatMap((g) =>
      (g.spec?.affects ?? [])
        .filter((a) => groups.includes(a))
        .map((a) => ({
          key: `gg-${g.id}-${a}`,
          from: `gap:${g.id}`,
          to: `group:${a}`,
          dashed: true,
          label: mc.unaffect(g.name, nameOf(a)),
          remove: () => affect.mutate({ gap: g.id, remove: a }),
        })),
    ),
  ];

  const breaks = [
    ...cited.filter((g) => gapState(g) === "outside").map((g) => ({ key: `gap-${g.id}`, text: mc.gapOutside(g.name), gap: g.id, unknown: false })),
    ...cited.filter((g) => gapState(g) === "unknown").map((g) => ({ key: `unknown-${g.id}`, text: mc.gapUnknown(g.name), gap: g.id, unknown: true })),
    ...(knows ? groups.filter((g) => !groupOk(g)).map((g) => ({ key: `group-${g}`, text: mc.groupOutside(nameOf(g)), gap: undefined, unknown: false })) : []),
  ];

  const drawingFrom = drawing && places[drawing.node] ? centre(places[drawing.node]) : null;

  return (
    <section aria-label={mc.label} className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3" data-cartograph-region="problem-map">
      <p className="text-xs text-muted-foreground">{drawing ? (drawing.at ? mc.dropHint : mc.clickHint) : project ? mc.drawHint : null}</p>
      <div ref={box} className="relative" onPointerMove={move} onPointerUp={end}>
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
          {edges.map((ed) => {
            const a = places[ed.from];
            const b = places[ed.to];
            if (!a || !b) return null;
            const p = right(a);
            const q = left(b);
            // A gap's link to a group passes the problem: it arcs beneath
            // the nodes rather than behind the problem.
            const dip = ed.dashed ? Math.max(a.y + a.h, b.y + b.h, places.problem ? places.problem.y + places.problem.h : 0) + 18 : 0;
            const d = ed.dashed
              ? `M${p.x},${p.y} C${p.x + 30},${dip} ${q.x - 30},${dip} ${q.x},${q.y}`
              : `M${p.x},${p.y} C${(p.x + q.x) / 2},${p.y} ${(p.x + q.x) / 2},${q.y} ${q.x},${q.y}`;
            return (
              <g key={ed.key} className="pointer-events-auto cursor-pointer" onClick={ed.remove} data-edge={ed.key}>
                <title>{ed.label}</title>
                <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                <path d={d} fill="none" stroke="var(--color-muted-foreground)" strokeOpacity={ed.dashed ? 0.45 : 0.8} strokeWidth={1.5} strokeDasharray={ed.dashed ? "4 3" : undefined} />
              </g>
            );
          })}
          {drawingFrom && drawing?.at ? (
            <line x1={drawingFrom.x} y1={drawingFrom.y} x2={drawing.at.x} y2={drawing.at.y} stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="5 4" />
          ) : null}
        </svg>

        <div className="relative grid grid-cols-1 items-start gap-x-10 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
          <Column label={mc.gaps}>
            {cited.length === 0 && !gapOffer ? <Empty text={mc.noGaps} /> : null}
            {cited.map((g) => {
              const st = gapState(g);
              return (
                <Node key={g.id} id={`gap:${g.id}`} tone={st === "ok" ? "ok" : st === "unknown" ? "warn" : "broken"}>
                  <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  {project ? (
                    <Handle side="right" label={mc.drawAffects(g.name)} onPointerDown={(e) => start(e, "gap-group", g.id, `gap:${g.id}`)} />
                  ) : null}
                </Node>
              );
            })}
            {gapOffer ? <Offer items={gapOffer.filter((c) => !c.linked)} onPick={(id) => (connect(drawing!, id), setDrawing(null))} /> : null}
          </Column>

          <Column label={mc.problem}>
            <Node id="problem" tone={line.problem?.situation ? "ok" : "warn"}>
              {project ? <Handle side="left" label={mc.drawGap} onPointerDown={(e) => start(e, "problem-gap", project, "problem")} /> : null}
              <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-2 min-w-0 flex-1">{line.problem?.situation || copy.projects.aim.problemUnwritten}</span>
              {project ? <Handle side="right" label={mc.drawGroup} onPointerDown={(e) => start(e, "problem-group", project, "problem")} /> : null}
            </Node>
          </Column>

          <Column label={mc.groups}>
            {groups.length === 0 && !groupOffer ? <Empty text={mc.noGroups} /> : null}
            {groups.map((g) => (
              <Node key={g} id={`group:${g}`} tone={groupOk(g) ? "ok" : "broken"}>
                <Users className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{nameOf(g)}</span>
              </Node>
            ))}
            {groupOffer ? (
              <Offer
                items={groupOffer.filter((c) => !(drawing?.link === "problem-group" ? groups.includes(c.id) : false))}
                onPick={(id) => (connect(drawing!, id), setDrawing(null))}
              />
            ) : null}
          </Column>
        </div>
      </div>

      {suggest.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{mc.suggest}</span>
          {suggest.map((g) => (
            <Button key={g} type="button" variant="outline" size="sm" onClick={() => onAddGroup(g)} aria-label={mc.addGroup(nameOf(g))}>
              <Plus />
              {nameOf(g)}
            </Button>
          ))}
        </div>
      ) : null}

      {breaks.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm" data-slot="problem-map-breaks">
          {breaks.map((b) => (
            <li key={b.key} className={`flex items-start gap-2 ${b.unknown ? "text-foreground" : "text-destructive"}`}>
              <CircleAlert className={`mt-0.5 size-4 shrink-0 ${b.unknown ? "text-warning" : ""}`} aria-hidden="true" />
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {b.text}
                {b.unknown && b.gap && groups.length > 0 ? (
                  <Button type="button" variant="outline" size="sm" disabled={affect.isPending} onClick={() => affect.mutate({ gap: b.gap as string, add: groups })}>
                    <Users />
                    {mc.useGroups(groups.map(nameOf).join(", "))}
                  </Button>
                ) : null}
                {b.gap ? (
                  <Link to="/gaps/$id" params={{ id: b.gap }} className="text-muted-foreground underline">
                    {mc.openGap}
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : cited.length > 0 && groups.length > 0 ? (
        <p className="text-sm text-muted-foreground">{mc.holds}</p>
      ) : null}
    </section>
  );
}

const centre = (p: { x: number; y: number; w: number; h: number }) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
const right = (p: { x: number; y: number; w: number; h: number }) => ({ x: p.x + p.w, y: p.y + p.h / 2 });
const left = (p: { x: number; y: number; w: number; h: number }) => ({ x: p.x, y: p.y + p.h / 2 });

/** Records a link being drawn could reach: those it may join take it,
 * the rest are dimmed and say why. */
function Offer({ items, onPick }: { items: LinkCandidate[]; onPick: (id: string) => void }) {
  if (items.length === 0) return <Empty text={mc.nothingToLink} />;
  return (
    <div className="flex flex-col gap-1.5" data-slot="link-offer">
      {items.map((c) => (
        <button
          key={c.id}
          type="button"
          data-drop={c.id}
          data-allowed={c.allowed ? "true" : "false"}
          disabled={!c.allowed}
          onClick={() => c.allowed && onPick(c.id)}
          title={c.allowed ? mc.linkTo(c.name) : c.reason}
          aria-label={c.allowed ? mc.linkTo(c.name) : `${c.name}: ${c.reason ?? ""}`}
          className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-sm transition-colors duration-150 ease-standard ${
            c.allowed ? "border-primary/40 bg-background hover:bg-primary/10" : "cursor-not-allowed border-dashed opacity-45"
          }`}
        >
          <span className="min-w-0 truncate">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

/** A node's handle: where a link starts, by dragging or by a click. */
function Handle({ side, label, onPointerDown }: { side: "left" | "right"; label: string; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      className={`absolute top-1/2 ${side === "left" ? "-left-2" : "-right-2"} size-4 -translate-y-1/2 cursor-crosshair touch-none rounded-full border-2 border-primary bg-background transition-transform duration-150 hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring`}
      data-handle={side}
    />
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5" aria-label={label} role="group">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const TONE = {
  ok: "border-border bg-background",
  warn: "border-warning/60 bg-warning/5",
  broken: "border-destructive border-dashed bg-destructive/5 text-destructive",
} as const;

function Node({ id, tone, children }: { id: string; tone: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <span
      className={`relative flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm ${TONE[tone]}`}
      data-tone={tone}
      data-node={id}
      data-map-gap={id.startsWith("gap:") ? id.slice(4) : undefined}
      data-map-group={id.startsWith("group:") ? id.slice(6) : undefined}
    >
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <span className="rounded-md border border-dashed px-2 py-1.5 text-sm text-muted-foreground">{text}</span>;
}
