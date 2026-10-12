import { CalendarSync } from "lucide-react";
import { useState } from "react";

import { monthNames } from "@/components/locale";
import { copy } from "@/copy";
import { useCycle, useCyclePeriods } from "./api";

/**
 * What the chosen cycle actually means, spelled out.
 *
 * Picking "Seasonal Cycle" tells you nothing about when a number is due.
 * The cycle knows — every three months, starting in September, or terms
 * ending December, April and July — and the periods follow from that, so
 * the reader can see them rather than work them out (Programme Lead,
 * 2026-09-29). The same idea as an editor showing a function's signature
 * when you reach for it: the definition, where the decision is. The
 * periods are the engine's (TAXONOMY.md D40), laid out over this year.
 */
export function CycleSignature({ id }: { id: string | undefined }) {
  const { data } = useCycle(id);
  const year = new Date().getUTCFullYear();
  const periods = useCyclePeriods(id, data ? { from: `${year}-01`, to: `${year}-12` } : null);
  const c = copy.kpis.cycleSignature;
  if (!id || !data) return null;
  if (data.periodDays) return <DaysSignature days={data.periodDays} start={data.startDate} id={id} />;
  const named = data.periodNames.length > 0;
  if (!named && !data.periodMonths) return null;

  // A year of this cycle, so the months a reading is due read as examples
  // rather than as a rule somebody has to apply.
  const ends = (periods.data ?? [])
    .filter((p) => p.end.startsWith(`${year}-`))
    .map((p) => (named ? `${p.name ?? p.end} (${monthName(Number(p.end.slice(5)))})` : p.end.slice(5)))
    .slice(0, 12);

  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <CalendarSync className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {named ? c.named(data.periodNames.join(", ")) : `${c.every(data.periodMonths)} ${c.startingIn(monthName(data.startMonth))}`}
        {ends.length > 0 ? ` ${c.periodsEnd(ends.join(", "))}` : ""}
      </span>
    </p>
  );
}

// In the reader's language (components/locale).
const MONTHS = monthNames("long");

function monthName(n: number): string {
  return MONTHS[Math.min(Math.max(n, 1), 12) - 1];
}

/** A cycle of days (engine TAXONOMY.md D68): how often, from which day,
 * and the next few days a reading is filed by. */
function DaysSignature({ id, days, start }: { id: string; days: number; start: string }) {
  const c = copy.kpis.cycleSignature;
  // Today, read once: what is upcoming is as of when the page opened.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const month = today.slice(0, 7);
  const next = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 7);
  const periods = useCyclePeriods(id, { from: month, to: next });
  const ends = (periods.data ?? [])
    .map((p) => p.end)
    .filter((e) => e >= today)
    .slice(0, 3)
    .map(dayWords);
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <CalendarSync className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {c.everyDays(days)} {start ? c.fromDay(dayWords(start)) : ""}
        {ends.length > 0 ? ` ${c.nextEnd(ends.join(", "))}` : ""}
      </span>
    </p>
  );
}

/** A day in the reader's words: 5 January 2026. */
function dayWords(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${monthName(m)} ${y}`;
}
