import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";

import { FromIdea } from "@/components/FromIdea";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy, plusNoun } from "@/copy";
import { useSectionAutosave, useProjectStore } from "../store";
import { addTimelineMonths as addMonths, timelineMonthIndex as monthIndex, type TimelinePhase } from "../types";
import { seg } from "../field";

const tc = copy.projects.timeline;

/** The shared axis every phase bar and year tick is positioned against
 * (card §2, Timeline: "phases show the bar on a shared axis with year
 * ticks as drawn"): the total months rounded up to a whole number of
 * years, so a tick always lands on a clean fraction rather than an
 * arbitrary one that would shift every time a phase's own length changes. */
function axisDenominator(totalMonths: number): number {
  return Math.max(12, Math.ceil(totalMonths / 12) * 12);
}

/** Every calendar year whose January falls within the axis, with its left
 * offset as a percentage of the axis. */
function yearTicks(start: string, denom: number): { year: number; leftPercent: number }[] {
  const startIdx = monthIndex(start);
  if (startIdx === undefined) return [];
  const startYear = Math.floor(startIdx / 12);
  const ticks: { year: number; leftPercent: number }[] = [];
  for (let year = startYear; year <= startYear + Math.ceil(denom / 12) + 1; year++) {
    const offset = year * 12 - startIdx;
    if (offset >= 0 && offset < denom) {
      ticks.push({ year, leftPercent: (offset / denom) * 100 });
    }
  }
  return ticks;
}

export function TimelineSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const timeline = store.spec.timeline ?? { start: "", phases: [] };
  const phases = timeline.phases ?? [];

  function updateTimeline(patch: Partial<typeof timeline>) {
    store.updateSpec((s) => ({ ...s, timeline: { ...timeline, ...patch } }));
  }

  function updatePhase(idx: number, patch: Partial<TimelinePhase>) {
    const next = [...phases];
    next[idx] = { ...next[idx], ...patch };
    updateTimeline({ phases: next });
  }

  function addPhase() {
    updateTimeline({ phases: [...phases, { name: "", months: 1 }] });
  }

  function removePhase(idx: number) {
    updateTimeline({ phases: phases.filter((_, i) => i !== idx) });
  }

  /** Moves the phase at `from` to sit at `to`. The bars, the dates and
   * the derived end all follow from the order, so reordering is the whole
   * edit: nothing else has to be touched. */
  function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= phases.length) return;
    const next = [...phases];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateTimeline({ phases: next });
  }

  const rows = phases.reduce<{ name: string; months: number; start: string; end: string; offset: number }[]>(
    (acc, p) => {
      const start = acc.length > 0 ? acc[acc.length - 1].end : timeline.start;
      const end = start ? addMonths(start, p.months) : "";
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].months : 0;
      return [...acc, { ...p, start, end, offset }];
    },
    [],
  );
  const derivedEnd = rows.length > 0 ? rows[rows.length - 1].end : "";
  const totalMonths = phases.reduce((sum, p) => sum + (p.months || 0), 0);
  const denom = axisDenominator(totalMonths);
  const ticks = timeline.start ? yearTicks(timeline.start, denom) : [];

  return (
    <div className="flex flex-col gap-4">
      <FromIdea field="/spec/timeline" />
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-2">
          <Label>{tc.startLabel}</Label>
          <MonthPicker
            data-cartograph-field="/spec/timeline/start"
            value={timeline.start}
            onChange={(v) => updateTimeline({ start: v })}
            className="w-36"
            aria-label={tc.startLabel}
          />
        </div>
        {derivedEnd ? (
          <span className="mt-6 text-sm text-muted-foreground">{tc.derivedLine(derivedEnd, totalMonths, phases.length)}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2" data-cartograph-region="phases">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{tc.empty}</p> : null}
        {rows.length > 0 ? (
          <div className="grid grid-cols-[1.75rem_minmax(8rem,2fr)_6.5rem_minmax(0,2fr)_9rem] items-center gap-3">
            <div />
            <span className="text-xs font-medium text-muted-foreground">{tc.phaseNameLabel}</span>
            <span className="text-xs font-medium text-muted-foreground">{tc.monthsLabel}</span>
            <div className="relative h-4">
              {ticks.map((t) => (
                <span
                  key={t.year}
                  className="absolute top-0 pl-1 text-[11px] text-muted-foreground"
                  style={{ left: `${t.leftPercent}%` }}
                >
                  {t.year}
                </span>
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">{tc.derivedColumnLabel}</span>
          </div>
        ) : null}
        {rows.map((row, idx) => (
          <div
            key={idx}
            data-slot="phase-row"
            data-index={idx}
            data-cartograph-region={`phase-${idx}`}
            className={`grid grid-cols-[1.75rem_minmax(8rem,2fr)_6.5rem_minmax(0,2fr)_9rem] items-center gap-3 rounded-lg border p-3 transition-colors ${
              dragOver === idx && dragging !== null && dragging !== idx ? "border-primary bg-accent" : ""
            } ${dragging === idx ? "opacity-50" : ""}`}
            onDragOver={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              setDragOver(idx);
            }}
            onDragLeave={() => setDragOver((prev) => (prev === idx ? null : prev))}
            onDrop={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              reorder(dragging, idx);
              setDragging(null);
              setDragOver(null);
            }}
          >
            {/* The handle is the drag source and the keyboard control at
                once: dragging is the obvious mechanic, and the up and down
                arrows on a focused handle are how it stays reachable
                without a mouse. */}
            <button
              type="button"
              draggable
              aria-label={`${tc.dragHandleLabel}: ${row.name || idx + 1}`}
              className="flex cursor-grab items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(idx));
                setDragging(idx);
              }}
              onDragEnd={() => {
                setDragging(null);
                setDragOver(null);
              }}
              onKeyDown={(e) => {
                if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                e.preventDefault();
                const to = idx + (e.key === "ArrowUp" ? -1 : 1);
                if (to < 0 || to >= rows.length) return;
                reorder(idx, to);
                // Keep the handle of the row that moved under the finger.
                requestAnimationFrame(() => {
                  const next = document.querySelector<HTMLElement>(
                    `[data-slot="phase-row"][data-index="${to}"] button[draggable]`,
                  );
                  next?.focus();
                });
              }}
            >
              <GripVertical className="size-4" />
            </button>
            <Input
              data-cartograph-field={`/spec/timeline/phases/${seg(phases[idx], idx)}/name`}
              value={row.name}
              onChange={(e) => updatePhase(idx, { name: e.target.value.slice(0, 40) })}
              placeholder={tc.phaseNamePlaceholder}
              aria-label={tc.phaseNameLabel}
              maxLength={40}
            />
            <div className="flex items-center gap-1">
              <Input
                data-cartograph-field={`/spec/timeline/phases/${seg(phases[idx], idx)}/months`}
                type="number"
                min={1}
                max={60}
                value={row.months}
                onChange={(e) => updatePhase(idx, { months: Number(e.target.value) })}
                aria-label={tc.monthsLabel}
                className="w-16"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => removePhase(idx)}
                aria-label={tc.removePhaseLabel}
              >
                <X />
              </Button>
            </div>
            <div className="relative h-6">
              {ticks.map((t) => (
                <div key={t.year} className="absolute top-0 bottom-0 border-l" style={{ left: `${t.leftPercent}%` }} />
              ))}
              <div
                className="absolute top-0.5 h-5 rounded-md bg-primary"
                style={{
                  left: `${(row.offset / denom) * 100}%`,
                  width: `${(row.months / denom) * 100}%`,
                  opacity: Math.max(0.35, 1 - idx * 0.16),
                }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {row.start} &rarr; {row.end}
            </span>
          </div>
        ))}
        <Button type="button" variant="outline" className="self-start border-dashed" onClick={addPhase} aria-label={tc.addPhase}>
          <Plus />
          {plusNoun(tc.addPhase)}
        </Button>
      </div>
    </div>
  );
}
