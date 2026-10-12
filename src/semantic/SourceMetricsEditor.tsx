import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Check, CircleAlert, Plus, X } from "lucide-react";

import { useClient } from "@/client/context";
import type { AggregationReading } from "@/client/port";
import { Help } from "@/components/guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";

const mc = copy.sourceMetrics;

/** One number a data source gives (engine TAXONOMY.md D64). */
export interface SourceMetric {
  id: string;
  name: string;
  description?: string;
  aggregation: string;
  /** What one entry it counts is, in a source holding several kinds. */
  over?: string;
}

/** The words an aggregation is written in, offered as it is typed. */
const WORDS = ["COUNT(*)", "COUNT(DISTINCT ", "SUM(", "AVG(", "MIN(", "MAX(", "WHERE", "AND", "OR", "NOT", "IN (", "BETWEEN", "LIKE", "IS NULL", "IS NOT NULL", "true", "false"];

/** A fresh id for a metric: generated, never derived from its name. */
function freshId(taken: string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`metric-${n}`)) n++;
  return `metric-${n}`;
}

/** What the engine reads an aggregation as, asked once it rests. */
function useReading(text: string) {
  const client = useClient();
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const t = setTimeout(() => setSettled(text), 250);
    return () => clearTimeout(t);
  }, [text]);
  return useQuery({
    queryKey: ["aggregation", settled],
    queryFn: () => client.readAggregation(settled),
    enabled: settled.trim() !== "",
    staleTime: Infinity,
  });
}

/**
 * A data source's metrics, each a name, what it is in words, and its
 * aggregation in pseudocode SQL (engine TAXONOMY.md D64). The aggregation
 * box offers the words it is written in and the names the source's other
 * metrics use, and says beneath it what the engine reads, or why not.
 */
export function SourceMetricsEditor({
  value,
  onChange,
  several = false,
}: {
  value: SourceMetric[] | "";
  onChange: (next: SourceMetric[] | undefined) => void;
  /** The source holds more than one kind of record (a warehouse): each
   * metric says which it counts over (engine TAXONOMY.md D67). */
  several?: boolean;
}) {
  const client = useClient();
  const metrics = value || [];
  // Every name the source's metrics use, for each box to offer.
  const readings = useQueries({
    queries: metrics.map((m) => ({
      queryKey: ["aggregation", m.aggregation],
      queryFn: () => client.readAggregation(m.aggregation),
      enabled: m.aggregation.trim() !== "",
      staleTime: Infinity,
    })),
  });
  const names = [...new Set(readings.flatMap((r) => (r.data as AggregationReading | undefined)?.names ?? []))];
  const set = (i: number, patch: Partial<SourceMetric>) => onChange(metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => {
    const next = metrics.filter((_, j) => j !== i);
    onChange(next.length ? next : undefined);
  };
  return (
    <div className="flex flex-col gap-3" data-cartograph-field="/spec/metrics">
      {/* What a metric is, said where it is written rather than behind a
          help mark: an aggregation that states intent, not the canonical
          calculation (#99). */}
      <p className="text-xs text-muted-foreground text-pretty">{mc.lead}</p>
      {metrics.length === 0 ? <p className="text-sm text-muted-foreground">{mc.none}</p> : null}
      {metrics.map((m, i) => (
        <MetricRow key={m.id} metric={m} index={i} names={names} several={several} onChange={(patch) => set(i, patch)} onRemove={() => remove(i)} />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        aria-label={mc.addHint}
        title={mc.addHint}
        onClick={() => onChange([...metrics, { id: freshId(metrics.map((x) => x.id)), name: "", aggregation: "" }])}
      >
        <Plus />
        {mc.add}
      </Button>
    </div>
  );
}

function MetricRow({ metric, index, names, several, onChange, onRemove }: { metric: SourceMetric; index: number; names: string[]; several: boolean; onChange: (patch: Partial<SourceMetric>) => void; onRemove: () => void }) {
  const ids = useId();
  const at = `/spec/metrics/${index}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg p-3 ring-1 ring-foreground/10" data-slot="source-metric">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${ids}-name`} className="text-xs text-muted-foreground">
          {mc.name}
        </label>
        <div className="flex items-center gap-2">
          <Input id={`${ids}-name`} value={metric.name} onChange={(e) => onChange({ name: e.target.value.slice(0, 120) })} aria-label={mc.name} aria-describedby={`${ids}-name-hint`} className="font-medium" data-cartograph-field={`${at}/name`} />
          <Button type="button" variant="ghost" size="icon-sm" aria-label={mc.removeHint(metric.name)} title={mc.removeHint(metric.name)} onClick={onRemove}>
            <X />
          </Button>
        </div>
        <p id={`${ids}-name-hint`} className="text-xs text-muted-foreground">{mc.nameHint}</p>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <label htmlFor={`${ids}-desc`} className="text-xs text-muted-foreground">
            {mc.description}
          </label>
          <Help label={mc.description} hint={mc.descriptionHint} />
        </div>
        <Textarea id={`${ids}-desc`} rows={1} value={metric.description ?? ""} onChange={(e) => onChange({ description: e.target.value.slice(0, 400) || undefined })} aria-describedby={`${ids}-desc-hint`} data-cartograph-field={`${at}/description`} />
        <p id={`${ids}-desc-hint`} className="text-xs text-muted-foreground">{mc.descriptionHint}</p>
      </div>
      {several || metric.over ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-over`} className="text-xs text-muted-foreground">
            {mc.over}
          </label>
          <Input id={`${ids}-over`} value={metric.over ?? ""} onChange={(e) => onChange({ over: e.target.value.slice(0, 240) || undefined })} aria-describedby={`${ids}-over-hint`} data-cartograph-field={`${at}/over`} />
          <p id={`${ids}-over-hint`} className="text-xs text-muted-foreground">{mc.overHint}</p>
        </div>
      ) : null}
      <AggregationField id={`${ids}-agg`} value={metric.aggregation} names={names} field={`${at}/aggregation`} onChange={(aggregation) => onChange({ aggregation })} />
    </div>
  );
}

/** The word being typed at the caret, and where it starts. */
function wordAt(text: string, caret: number): { word: string; start: number } {
  let start = caret;
  while (start > 0 && /[A-Za-z_]/.test(text[start - 1])) start--;
  return { word: text.slice(start, caret), start };
}

function AggregationField({ id, value, names, field, onChange }: { id: string; value: string; names: string[]; field: string; onChange: (v: string) => void }) {
  const reading = useReading(value);
  const input = useRef<HTMLInputElement>(null);
  // Where the cursor goes once an accepted suggestion is in the value.
  const placeCaret = useRef<number | null>(null);
  useEffect(() => {
    if (placeCaret.current === null) return;
    input.current?.setSelectionRange(placeCaret.current, placeCaret.current);
    placeCaret.current = null;
  }, [value]);
  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { word, start } = wordAt(value, caret);
  const options = useMemo(() => {
    if (!word) return [];
    const w = word.toLowerCase();
    return [...names, ...WORDS].filter((o) => o.toLowerCase().startsWith(w) && o.toLowerCase() !== w).slice(0, 6);
  }, [word, names]);
  const shown = open && options.length > 0;
  const listId = `${id}-options`;

  function accept(option: string) {
    const next = value.slice(0, start) + option + value.slice(caret);
    onChange(next.slice(0, 400));
    setCaret(start + option.length);
    placeCaret.current = start + option.length;
    setOpen(false);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!shown) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      accept(options[Math.min(active, options.length - 1)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }
  const r = reading.data;
  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="text-xs text-muted-foreground">
          {copy.sourceMetrics.aggregation}
        </label>
        <Help label={copy.sourceMetrics.aggregation} hint={copy.sourceMetrics.aggregationHint} />
      </div>
      <Input
        ref={input}
        id={id}
        value={value}
        className="font-mono text-sm"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown ? `${listId}-${active}` : undefined}
        data-cartograph-field={field}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value.slice(0, 400));
          setCaret(e.target.selectionStart ?? e.target.value.length);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKey}
        onBlur={() => setOpen(false)}
        onSelect={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
      />
      {shown ? (
        <ul id={listId} role="listbox" aria-label={copy.sourceMetrics.suggestions} className="absolute top-full left-0 z-20 mt-1 min-w-48 rounded-md bg-popover p-1 font-mono text-sm shadow-md ring-1 ring-foreground/10">
          {options.map((o, i) => (
            <li
              key={o}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer rounded-sm px-2 py-1 ${i === active ? "bg-accent text-accent-foreground" : ""}`}
              // Before the input loses focus, so the choice lands.
              onMouseDown={(e) => {
                e.preventDefault();
                accept(o);
              }}
            >
              {o}
            </li>
          ))}
        </ul>
      ) : null}
      {/* Nothing written yet: aggregations to start from, each filling the
          field, rather than an empty box to guess at (#99). */}
      {!value.trim() ? (
        <div className="flex flex-col gap-1" data-slot="aggregation-examples">
          <p className="text-xs text-muted-foreground">{copy.sourceMetrics.startFrom}</p>
          <div className="flex flex-wrap gap-1">
            {copy.sourceMetrics.examples.map((ex) => (
              <button
                key={ex}
                type="button"
                className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                aria-label={copy.sourceMetrics.useExample(ex)}
                title={copy.sourceMetrics.useExample(ex)}
                onClick={() => {
                  onChange(ex);
                  input.current?.focus();
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {/* What the engine reads, or why not: never a bare tick. */}
      {value.trim() && r ? (
        r.problem ? (
          <p className="flex items-start gap-1 text-xs text-destructive" role="status" data-slot="aggregation-problem">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {r.problem}
          </p>
        ) : (
          <p className="flex items-start gap-1 text-xs text-muted-foreground" role="status" data-slot="aggregation-reading">
            <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
            {r.reading}
          </p>
        )
      ) : null}
    </div>
  );
}
