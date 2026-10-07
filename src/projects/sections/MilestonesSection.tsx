import { useQuery } from "@tanstack/react-query";
import { Flag, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClient } from "@/client/context";
import type { ScheduleItem } from "@/client/port";
import { copy } from "@/copy";
import { RoleRefPicker, roleOptions, useResourceNames } from "../RoleRefPicker";
import { TimingField } from "../TimingField";
import { useProjectStore, useSectionAutosave } from "../store";
import { addTimelineMonths, type Milestone } from "../types";

const mc = copy.projects.milestones;

const ROW = 30;
const monthName = (i: number) => new Date(2000, i, 1).toLocaleString(undefined, { month: "short" });
const LABEL = 190;

function monthIndex(m: string | undefined): number | undefined {
  const r = /^(\d{4})-(\d{2})/.exec(m ?? "");
  return r ? Number(r[1]) * 12 + Number(r[2]) - 1 : undefined;
}

/**
 * The schedule as milestones (engine TAXONOMY.md D48): a chart of each
 * milestone on time, with what it waits on drawn as a line from what comes
 * first, and the chain that decides the last date marked; then each
 * milestone to edit. Dragging from one milestone's mark to another's row
 * makes the second follow the first.
 */
export function MilestonesSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const client = useClient();
  const milestones = store.spec.milestones ?? [];
  const schedule = useQuery({ queryKey: ["schedule", store.id], queryFn: () => client.schedule(store.id), enabled: milestones.length > 0 });
  const names = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], names);
  const deliverables = store.spec.deliverables ?? [];

  const set = (next: Milestone[]) => store.updateSpec((s) => ({ ...s, milestones: next.length > 0 ? next : undefined }));
  const patch = (i: number, p: Partial<Milestone>) => set(milestones.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const add = () => {
    const n = milestones.length + 1;
    let id = `m${n}`;
    while (milestones.some((m) => m.id === id)) id = `${id}-1`;
    set([...milestones, { id, name: "", timing: { form: "date" } }]);
  };

  // Phases from before milestones become milestones: each phase's end.
  const phases = store.spec.timeline?.phases ?? [];
  const start = store.spec.timeline?.start;
  function fromPhases() {
    // Each phase ends in its last month: a three-month phase from
    // September ends in November.
    let at = start ?? "";
    const next: Milestone[] = phases.map((p, i) => {
      const end = at ? addTimelineMonths(at, Math.max(1, p.months) - 1) : "";
      at = end ? addTimelineMonths(end, 1) : at;
      return { id: p.id ?? `m${i + 1}`, name: p.name, timing: end ? { form: "date", date: end } : { form: "date" } };
    });
    set(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {milestones.length > 0 ? (
        <MilestoneChart
          items={schedule.data ?? []}
          onLink={(from, to) => {
            const i = milestones.findIndex((m) => m.id === to);
            if (i < 0 || from === to) return;
            patch(i, { timing: { form: "after", event: { on: { local: "milestones", id: from } } } });
          }}
        />
      ) : null}
      {milestones.length === 0 && phases.length > 0 ? (
        <Button type="button" variant="outline" className="self-start" onClick={fromPhases} title={mc.fromPhasesHint} aria-label={mc.fromPhasesHint}>
          <Flag />
          {mc.fromPhases}
        </Button>
      ) : null}
      <ol className="flex flex-col gap-3" data-cartograph-field="/spec/milestones">
        {milestones.map((m, i) => (
          <li key={m.id} className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10" data-milestone={m.id}>
            <div className="flex items-center gap-2">
              <span className="flex h-6 min-w-8 items-center justify-center rounded-md bg-muted px-1 text-xs font-medium text-muted-foreground">M{i + 1}</span>
              <Input
                value={m.name}
                onChange={(e) => patch(i, { name: e.target.value.slice(0, 120) })}
                maxLength={120}
                aria-label={mc.name}
                data-cartograph-field={`/spec/milestones/${i}/name`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => set(milestones.filter((_, j) => j !== i))}
                aria-label={mc.remove(m.name || `M${i + 1}`)}
                title={mc.remove(m.name || `M${i + 1}`)}
              >
                <Trash2 />
              </Button>
            </div>
            <TimingField
              value={m.timing}
              onChange={(timing) => patch(i, { timing: timing ?? { form: "date" } })}
              field={`/spec/milestones/${i}/timing`}
              label={mc.when}
              exclude={m.id}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                <span>{mc.owner}</span>
                <RoleRefPicker
                  value={m.owner}
                  options={roles}
                  onChange={(owner) => patch(i, { owner })}
                  label={mc.owner}
                  withBodies className="w-full"
                  data-cartograph-field={`/spec/milestones/${i}/owner`}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={mc.evidenceHint}>
                {mc.evidence}
                <Input
                  value={m.evidence ?? ""}
                  onChange={(e) => patch(i, { evidence: e.target.value.slice(0, 240) || undefined })}
                  maxLength={240}
                  aria-label={mc.evidence}
                  data-cartograph-field={`/spec/milestones/${i}/evidence`}
                />
              </label>
            </div>
            {deliverables.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5" data-cartograph-field={`/spec/milestones/${i}/deliverables`}>
                <span className="text-xs text-muted-foreground">{mc.marks}</span>
                {deliverables.map((d) => {
                  const on = (m.deliverables ?? []).includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const cur = m.deliverables ?? [];
                        const next = on ? cur.filter((x) => x !== d.id) : [...cur, d.id];
                        patch(i, { deliverables: next.length > 0 ? next : undefined });
                      }}
                      className={`rounded-md px-2 py-0.5 text-xs ring-1 ${on ? "bg-primary text-primary-foreground ring-primary" : "ring-foreground/15 hover:bg-muted"}`}
                    >
                      {d.name || d.id}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" className="self-start" onClick={add} aria-label={mc.addHint} title={mc.addHint}>
        <Plus />
        {mc.add}
      </Button>
    </div>
  );
}

/** The milestones on a time axis: a diamond where each falls, a bar for a
 * window, a hatched run to the expected month for one set once something
 * happens, a line from what each waits on, the critical chain in amber. */
function MilestoneChart({ items, onLink }: { items: ScheduleItem[]; onLink: (from: string, to: string) => void }) {
  const box = useRef<SVGSVGElement>(null);
  const frame = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState<{ from: string; x: number; y: number } | null>(null);
  // Drawn at the width it is shown at, so the text stays its size and
  // nothing hides behind a scrollbar.
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(420, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { min, span } = useMemo(() => {
    const ms = items.flatMap((it) => [monthIndex(it.month), monthIndex(it.notBefore), monthIndex(it.notAfter)]).filter((v): v is number => v !== undefined);
    const lo = ms.length ? Math.min(...ms) - 1 : 0;
    const hi = ms.length ? Math.max(...ms) + 1 : 12;
    return { min: lo, span: Math.max(6, hi - lo) };
  }, [items]);
  const x = (m: string | undefined) => {
    const i = monthIndex(m);
    return i === undefined ? undefined : LABEL + ((i - min + 0.5) / span) * (width - LABEL - 16);
  };
  const row = new Map(items.map((it, i) => [it.id, i]));
  const height = items.length * ROW + 34;
  const years: { year: number; x: number }[] = [];
  const quarters: { label: string; x: number }[] = [];
  for (let i = min; i <= min + span; i++) {
    const x0 = LABEL + ((i - min) / span) * (width - LABEL - 16);
    if (i % 12 === 0) years.push({ year: i / 12, x: x0 });
    else if (span <= 24 && i % 3 === 0) quarters.push({ label: monthName(i % 12), x: x0 });
  }
  const today = x(new Date().toISOString().slice(0, 7));

  const toSvg = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  };

  return (
    <figure ref={frame} className="overflow-hidden rounded-xl bg-background ring-1 ring-foreground/10" data-slot="milestone-chart">
      <svg
        ref={box}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block touch-none select-none"
        role="img"
        aria-label={mc.chartLabel}
        onPointerMove={(e) => drag && setDrag({ ...drag, ...toSvg(e) })}
        onPointerUp={(e) => {
          if (!drag) return;
          const p = toSvg(e);
          const target = items[Math.floor((p.y - 24) / ROW)];
          if (target && target.id !== drag.from) onLink(drag.from, target.id);
          setDrag(null);
        }}
        onPointerLeave={() => setDrag(null)}
      >
        <defs>
          <pattern id="pending" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-muted-foreground)" strokeWidth="2" strokeOpacity=".35" />
          </pattern>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 8 4 0 8Z" fill="var(--color-muted-foreground)" />
          </marker>
        </defs>
        {years.map((y) => (
          <g key={y.year}>
            <line x1={y.x} x2={y.x} y1={18} y2={height} stroke="var(--color-border)" />
            <text x={y.x + 4} y={13} fontSize="11" fill="var(--color-muted-foreground)">
              {y.year}
            </text>
          </g>
        ))}
        {quarters.map((q) => (
          <g key={q.x}>
            <line x1={q.x} x2={q.x} y1={18} y2={height} stroke="var(--color-border)" strokeDasharray="2 3" />
            <text x={q.x + 3} y={13} fontSize="10" fill="var(--color-muted-foreground)">
              {q.label}
            </text>
          </g>
        ))}
        {today !== undefined ? <line x1={today} x2={today} y1={18} y2={height} stroke="var(--color-primary)" strokeDasharray="3 3" strokeOpacity=".6" /> : null}
        {items.map((it, i) => {
          const y = 24 + i * ROW + ROW / 2;
          const cx = x(it.month);
          return (
            <g key={it.id} data-schedule={it.id}>
              <text x={8} y={y + 4} fontSize="12" fill="var(--color-foreground)">
                <tspan fill="var(--color-muted-foreground)">M{i + 1} </tspan>
                {(it.name || it.id).length > 24 ? `${(it.name || it.id).slice(0, 23)}…` : it.name || it.id}
              </text>
              {it.notBefore && it.notAfter ? (
                <rect
                  x={x(it.notBefore)}
                  y={y - 5}
                  width={Math.max(4, (x(it.notAfter) ?? 0) - (x(it.notBefore) ?? 0))}
                  height={10}
                  rx={3}
                  fill="var(--color-primary)"
                  fillOpacity=".18"
                />
              ) : null}
              {it.pending && cx !== undefined ? <rect x={cx - 40} y={y - 5} width={40} height={10} rx={3} fill="url(#pending)" /> : null}
              {it.waitsOn.map((w) => {
                const j = row.get(w);
                const from = j === undefined ? undefined : items[j];
                const fx = x(from?.month);
                if (fx === undefined || cx === undefined || j === undefined) return null;
                const fy = 24 + j * ROW + ROW / 2;
                const crit = it.critical && from?.critical;
                return (
                  <path
                    key={w}
                    d={`M${fx + 6},${fy} H${(fx + cx) / 2} V${y} H${cx - 8}`}
                    fill="none"
                    stroke={crit ? "var(--color-warning)" : "var(--color-muted-foreground)"}
                    strokeOpacity={crit ? 0.9 : 0.5}
                    strokeWidth={crit ? 2 : 1.25}
                    markerEnd="url(#arrow)"
                  />
                );
              })}
              {cx !== undefined ? (
                <path
                  d={`M${cx},${y - 7} L${cx + 7},${y} L${cx},${y + 7} L${cx - 7},${y} Z`}
                  fill={it.pending ? "var(--color-background)" : it.critical ? "var(--color-warning)" : "var(--color-primary)"}
                  stroke={it.late ? "var(--color-destructive)" : it.critical ? "var(--color-warning)" : "var(--color-primary)"}
                  strokeWidth={1.5}
                  className="cursor-crosshair"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDrag({ from: it.id, ...toSvg(e) });
                  }}
                >
                  <title>{mc.dragHint}</title>
                </path>
              ) : (
                <text x={width - 16} y={y + 4} fontSize="11" textAnchor="end" fill="var(--color-muted-foreground)">
                  {mc.unplaced}
                </text>
              )}
            </g>
          );
        })}
        {drag ? (
          <line
            x1={x(items.find((it) => it.id === drag.from)?.month) ?? 0}
            y1={24 + (row.get(drag.from) ?? 0) * ROW + ROW / 2}
            x2={drag.x}
            y2={drag.y}
            stroke="var(--color-primary)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        ) : null}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rotate-45 bg-primary" aria-hidden="true" />
          {mc.legendDate}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rotate-45 bg-warning" aria-hidden="true" />
          {mc.legendCritical}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rotate-45 border border-primary bg-background" aria-hidden="true" />
          {mc.legendPending}
        </span>
        <span>{mc.dragHint}</span>
      </figcaption>
    </figure>
  );
}
