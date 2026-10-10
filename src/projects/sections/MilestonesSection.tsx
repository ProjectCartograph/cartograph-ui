import { useQuery } from "@tanstack/react-query";
import { ChevronUp, Flag, List, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClient } from "@/client/context";
import type { ScheduleItem } from "@/client/port";
import { copy } from "@/copy";
import { RoleRefPicker, roleOptions, useResourceNames } from "../RoleRefPicker";
import { TimingField } from "../TimingField";
import { useProjectStore, useSectionAutosave } from "../store";
import { RiskPrompt } from "../constraints/RiskPrompt";
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
  const milestones = useMemo(() => store.spec.milestones ?? [], [store.spec.milestones]);
  const schedule = useQuery({ queryKey: ["schedule", store.id], queryFn: () => client.schedule(store.id), enabled: milestones.length > 0 });
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [showAll, setShowAll] = useState(false);

  const set = (next: Milestone[]) => store.updateSpec((s) => ({ ...s, milestones: next.length > 0 ? next : undefined }));
  const patch = (i: number, p: Partial<Milestone>) => set(milestones.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const newId = () => {
    let n = milestones.length + 1;
    while (milestones.some((m) => m.id === `m${n}`)) n++;
    return `m${n}`;
  };
  const add = (date?: string) => {
    const id = newId();
    set([...milestones, { id, name: "", timing: date ? { form: "date", date } : { form: "date" } }]);
    setSelected(id);
  };
  // Moving a milestone on the time line moves its date, or its whole
  // window; one set by something else follows that, so it does not move.
  const move = (id: string, month: string) => {
    const i = milestones.findIndex((m) => m.id === id);
    if (i < 0) return;
    const t = milestones[i].timing;
    if (t.form === "date") patch(i, { timing: { ...t, date: withMonth(t.date, month) } });
    else if (t.form === "window" && t.notBefore && t.notAfter) {
      const by = (monthIndex(month) ?? 0) - (monthIndex(t.notBefore) ?? 0);
      patch(i, { timing: { ...t, notBefore: shift(t.notBefore, by), notAfter: shift(t.notAfter, by) } });
    }
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

  // The chart draws what the engine placed, with the person's own edits
  // over it at once: a new milestone, a name typed, a date dragged.
  const items = useMemo(() => {
    const served = new Map((schedule.data ?? []).map((it) => [it.id, it]));
    return milestones.map((m): ScheduleItem => {
      const it = served.get(m.id);
      const t = m.timing;
      const own = t.form === "date" ? { month: t.date?.slice(0, 7) } : t.form === "window" ? { notBefore: t.notBefore?.slice(0, 7), notAfter: t.notAfter?.slice(0, 7), month: it?.month ?? t.notBefore?.slice(0, 7) } : {};
      return { ...(it ?? { id: m.id, waitsOn: [], pending: false, late: false, critical: false, unplaced: false }), id: m.id, name: m.name, form: t.form, ...own };
    });
  }, [milestones, schedule.data]);
  const at = selected ? milestones.findIndex((m) => m.id === selected) : -1;

  return (
    <div className="flex flex-col gap-4">
      <MilestoneChart
        items={items}
        selected={selected}
        onSelect={setSelected}
        onMove={move}
        onAdd={add}
        onLink={(from, to) => {
          const i = milestones.findIndex((m) => m.id === to);
          if (i < 0 || from === to) return;
          patch(i, { timing: { form: "after", event: { on: { local: "milestones", id: from } } } });
        }}
      />
      {milestones.length === 0 && phases.length > 0 ? (
        <Button type="button" variant="outline" className="self-start" onClick={fromPhases} title={mc.fromPhasesHint} aria-label={mc.fromPhasesHint}>
          <Flag />
          {mc.fromPhases}
        </Button>
      ) : null}
      {at >= 0 && !showAll ? (
        <div data-cartograph-region="milestone-selected">
          <MilestoneEditor m={milestones[at]} i={at} patch={patch} remove={() => { set(milestones.filter((_, j) => j !== at)); setSelected(undefined); }} autoFocus={!milestones[at].name} />
        </div>
      ) : null}
      {at < 0 && !showAll && milestones.length > 0 ? <p className="text-sm text-muted-foreground">{mc.pickHint}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => add()} aria-label={mc.addHint} title={mc.addHint}>
          <Plus />
          {mc.add}
        </Button>
        {milestones.length > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setShowAll(!showAll)} aria-expanded={showAll} aria-label={showAll ? mc.hideList : mc.showList} title={showAll ? mc.hideList : mc.showList} data-cartograph-action="milestone-list">
            {showAll ? <ChevronUp /> : <List />}
            {mc.list(milestones.length)}
          </Button>
        ) : null}
      </div>
      {showAll ? (
        <ol className="flex flex-col gap-3" data-cartograph-field="/spec/milestones">
          {milestones.map((m, i) => (
            <li key={m.id}>
              <MilestoneEditor m={m} i={i} patch={patch} remove={() => set(milestones.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** A date moved to another month, its day kept where the month has it. */
function withMonth(date: string | undefined, month: string): string {
  const day = /^\d{4}-\d{2}-(\d{2})/.exec(date ?? "")?.[1];
  if (!day) return month;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(Number(day), last)).padStart(2, "0")}`;
}

/** A date moved by whole months, its day kept where the month has it. */
function shift(date: string, by: number): string {
  const i = monthIndex(date);
  return i === undefined ? date : withMonth(date, monthOf(i + by));
}

function monthOf(i: number): string {
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** One milestone to edit: its name, when it falls, who owns it, the
 * evidence it was reached and the deliverables it marks. */
function MilestoneEditor({ m, i, patch, remove, autoFocus }: { m: Milestone; i: number; patch: (i: number, p: Partial<Milestone>) => void; remove: () => void; autoFocus?: boolean }) {
  const store = useProjectStore();
  const names = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], names);
  const deliverables = store.spec.deliverables ?? [];
  return (
    <div className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10" data-milestone={m.id}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 min-w-8 items-center justify-center rounded-md bg-muted px-1 text-xs font-medium text-muted-foreground">{markOf(m.id, i)}</span>
        <Input
          value={m.name}
          onChange={(e) => patch(i, { name: e.target.value.slice(0, 120) })}
          maxLength={120}
          aria-label={mc.name}
          data-cartograph-field={`/spec/milestones/${i}/name`}
          className="flex-1"
          autoFocus={autoFocus}
        />
        <Button type="button" variant="ghost" size="icon" onClick={remove} aria-label={mc.remove(m.name || markOf(m.id, i))} title={mc.remove(m.name || markOf(m.id, i))}>
          <Trash2 />
        </Button>
      </div>
      <TimingField value={m.timing} onChange={(timing) => patch(i, { timing: timing ?? { form: "date" } })} field={`/spec/milestones/${i}/timing`} label={mc.when} exclude={m.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{mc.owner}</span>
          <RoleRefPicker value={m.owner} options={roles} onChange={(owner) => patch(i, { owner })} label={mc.owner} withBodies className="w-full" data-cartograph-field={`/spec/milestones/${i}/owner`} />
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
      {/* What happens if it is missed (#59). */}
      <RiskPrompt side="schedule" on={m.id} question={copy.projects.triangle.askMissed} short={copy.projects.triangle.shortMissed} />
    </div>
  );
}

const markOf = (id: string, i: number) => (/^m\d/i.test(id) && id.length <= 5 ? id.toUpperCase() : `M${i + 1}`);

/** The milestones on a time axis, worked on in place as a timeline is: a
 * diamond where each falls, a bar for a window, a hatched run to the
 * expected month for one set once something happens, a line from what
 * each waits on, the critical chain in amber. Drag a diamond to move it,
 * drag its dot onto another to make that one follow it, click a name to
 * edit it, and click the last row at a month to add one there. */
function MilestoneChart({
  items,
  selected,
  onSelect,
  onMove,
  onAdd,
  onLink,
}: {
  items: ScheduleItem[];
  selected?: string;
  onSelect: (id: string) => void;
  onMove: (id: string, month: string) => void;
  onAdd: (month: string) => void;
  onLink: (from: string, to: string) => void;
}) {
  const box = useRef<SVGSVGElement>(null);
  const frame = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState<{ mode: "link" | "move"; from: string; x: number; y: number; x0: number } | null>(null);
  const [hover, setHover] = useState<number | undefined>(undefined);
  // This month, read once when the chart opens.
  const [thisMonth] = useState(() => new Date().toISOString().slice(0, 7));
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
    const now = monthIndex(thisMonth) ?? 0;
    const lo = ms.length ? Math.min(...ms) - 1 : now - 1;
    const hi = ms.length ? Math.max(...ms) + 1 : now + 11;
    return { min: lo, span: Math.max(6, hi - lo + 1) };
  }, [items, thisMonth]);
  const plot = width - LABEL - 16;
  const xOf = (i: number) => LABEL + ((i - min + 0.5) / span) * plot;
  const x = (m: string | undefined) => {
    const i = monthIndex(m);
    return i === undefined ? undefined : xOf(i);
  };
  const monthAt = (px: number) => monthOf(Math.max(min, Math.min(min + span - 1, Math.round(((px - LABEL) / plot) * span - 0.5 + min))));
  const row = new Map(items.map((it, i) => [it.id, i]));
  const rows = items.length + 1;
  const height = rows * ROW + 34;
  const years: { year: number; x: number }[] = [];
  const quarters: { label: string; x: number }[] = [];
  for (let i = min; i <= min + span; i++) {
    const x0 = LABEL + ((i - min) / span) * plot;
    if (i % 12 === 0) years.push({ year: i / 12, x: x0 });
    else if (span <= 24 && i % 3 === 0) quarters.push({ label: monthName(i % 12), x: x0 });
  }
  const today = x(thisMonth);
  const rowAt = (y: number) => Math.floor((y - 24) / ROW);

  const toSvg = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  };
  const movable = (it: ScheduleItem) => (it.form === "date" || it.form === "window") && !it.unplaced;
  const shown = (it: ScheduleItem) => (drag?.mode === "move" && drag.from === it.id && Math.abs(drag.x - drag.x0) > 3 ? monthAt(drag.x) : it.month);

  return (
    <figure ref={frame} className="overflow-hidden rounded-xl bg-background ring-1 ring-foreground/10" data-slot="milestone-chart">
      <svg
        ref={box}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block touch-none select-none"
        role="group"
        aria-label={mc.chartLabel}
        onPointerMove={(e) => {
          const p = toSvg(e);
          setHover(p.x > LABEL ? rowAt(p.y) : undefined);
          if (drag) setDrag({ ...drag, ...p });
        }}
        onPointerUp={(e) => {
          const p = toSvg(e);
          if (drag) {
            if (drag.mode === "link") {
              const target = items[rowAt(p.y)];
              if (target && target.id !== drag.from) onLink(drag.from, target.id);
            } else if (Math.abs(p.x - drag.x0) > 3) onMove(drag.from, monthAt(p.x));
            else onSelect(drag.from);
            setDrag(null);
            return;
          }
          const r = rowAt(p.y);
          if (r < 0) return;
          if (p.x <= LABEL) {
            if (items[r]) onSelect(items[r].id);
            return;
          }
          if (r === items.length) onAdd(monthAt(p.x));
          else if (items[r]) {
            // A milestone with no month yet is given the one clicked.
            if (!items[r].month && items[r].form === "date") onMove(items[r].id, monthAt(p.x));
            onSelect(items[r].id);
          }
        }}
        onPointerLeave={() => {
          setDrag(null);
          setHover(undefined);
        }}
      >
        <defs>
          <pattern id="pending" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-muted-foreground)" strokeWidth="2" strokeOpacity=".35" />
          </pattern>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 8 4 0 8Z" fill="var(--color-muted-foreground)" />
          </marker>
        </defs>
        {items.map((it, i) =>
          it.id === selected || hover === i ? (
            <rect key={`band-${it.id}`} x={0} y={24 + i * ROW} width={width} height={ROW} fill="var(--color-muted)" fillOpacity={it.id === selected ? 1 : 0.5} />
          ) : null,
        )}
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
          const cx = x(shown(it));
          const moving = cx !== undefined && drag?.mode === "move" && drag.from === it.id;
          const by = moving ? cx - (x(it.month) ?? cx) : 0;
          return (
            <g key={it.id} data-schedule={it.id} aria-current={it.id === selected ? "true" : undefined}>
              <text x={8} y={y + 4} fontSize="12" fill="var(--color-foreground)" fontWeight={it.id === selected ? 600 : 400} className="cursor-pointer">
                <tspan fill="var(--color-muted-foreground)">{markOf(it.id, i)} </tspan>
                {(it.name || mc.unnamed).length > 24 ? `${(it.name || mc.unnamed).slice(0, 23)}…` : it.name || mc.unnamed}
              </text>
              {it.notBefore && it.notAfter ? (
                <rect
                  x={(x(it.notBefore) ?? 0) + by}
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
                const fx = from ? x(shown(from)) : undefined;
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
                <>
                  <path
                    d={`M${cx},${y - 7} L${cx + 7},${y} L${cx},${y + 7} L${cx - 7},${y} Z`}
                    fill={it.pending ? "var(--color-background)" : it.critical ? "var(--color-warning)" : "var(--color-primary)"}
                    stroke={it.late ? "var(--color-destructive)" : it.critical ? "var(--color-warning)" : "var(--color-primary)"}
                    strokeWidth={1.5}
                    className={movable(it) ? "cursor-ew-resize" : "cursor-pointer"}
                    data-cartograph-action="milestone-move"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const p = toSvg(e);
                      if (movable(it)) setDrag({ mode: "move", from: it.id, ...p, x0: p.x });
                      else onSelect(it.id);
                    }}
                  >
                    <title>{movable(it) ? mc.moveHint : mc.followsHint}</title>
                  </path>
                  {hover === i || it.id === selected ? (
                    <circle
                      cx={cx + 14}
                      cy={y}
                      r={4}
                      fill="var(--color-background)"
                      stroke="var(--color-primary)"
                      strokeWidth={1.5}
                      className="cursor-crosshair"
                      data-cartograph-action="milestone-link"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const p = toSvg(e);
                        setDrag({ mode: "link", from: it.id, ...p, x0: p.x });
                      }}
                    >
                      <title>{mc.dragHint}</title>
                    </circle>
                  ) : null}
                </>
              ) : it.unplaced ? (
                <text x={width - 16} y={y + 4} fontSize="11" textAnchor="end" fill="var(--color-muted-foreground)">
                  {mc.unplaced}
                </text>
              ) : hover === i ? (
                <text x={width - 16} y={y + 4} fontSize="11" textAnchor="end" fill="var(--color-muted-foreground)">
                  {mc.placeHint}
                </text>
              ) : null}
            </g>
          );
        })}
        <g data-cartograph-action="milestone-add" className="cursor-copy">
          <text x={8} y={24 + items.length * ROW + ROW / 2 + 4} fontSize="12" fill="var(--color-muted-foreground)">
            + {mc.addRow}
          </text>
          {hover === items.length && !drag ? (
            <text x={width - 16} y={24 + items.length * ROW + ROW / 2 + 4} fontSize="11" textAnchor="end" fill="var(--color-muted-foreground)">
              {mc.addAtHint}
            </text>
          ) : null}
        </g>
        {drag?.mode === "link" ? (
          <line
            x1={(x(items.find((it) => it.id === drag.from)?.month) ?? 0) + 14}
            y1={24 + (row.get(drag.from) ?? 0) * ROW + ROW / 2}
            x2={drag.x}
            y2={drag.y}
            stroke="var(--color-primary)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        ) : null}
        {drag?.mode === "move" && Math.abs(drag.x - drag.x0) > 3 ? (
          <text x={drag.x} y={24 + (row.get(drag.from) ?? 0) * ROW + 6} fontSize="10" textAnchor="middle" fill="var(--color-primary)">
            {monthAt(drag.x)}
          </text>
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
        <span>{mc.chartHint}</span>
      </figcaption>
    </figure>
  );
}
