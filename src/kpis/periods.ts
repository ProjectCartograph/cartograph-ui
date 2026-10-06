/**
 * Which periods a KPI has, laid out by the engine from the cycle it names.
 *
 * Nothing stores the list. A KPI names a ReportingCycle, and the engine
 * derives the cycle's periods (equal ones from its start month, or its
 * named terms and waves; TAXONOMY.md D8, D40), so every interface lays
 * them out the same way. This module only works out which months to ask
 * about and puts each reading in its period. A period with no reading is
 * one nobody has read yet, which is a state worth seeing rather than a
 * zero.
 */

import type { CyclePeriod } from "@/client/port";

export interface Reading {
  period: string;
  value: number;
  provisional?: boolean;
  note?: string;
}

/** One period of the cycle, and the reading for it if there is one. */
export interface Slot {
  /** The month the period ends, as YYYY-MM: the key a reading is filed
   * under. */
  period: string;
  /** The month it starts, for a label a person can read. */
  startsOn: string;
  /** The period's name with its year ("Term I 2026/27"), where the cycle
   * names its periods; equal periods are read by the month they end. */
  label?: string;
  reading?: Reading;
}

/** What a person reads for a period: its name where it has one, else the
 * month it ends. */
export function periodLabel(slot: { period: string; label?: string }): string {
  return slot.label ?? slot.period;
}

/**
 * The months to lay periods out over: from the earliest to the latest of
 * the baseline, the target and every reading, because those are the dates
 * the KPI already commits to, and a number somebody recorded is never
 * hidden by a target moving. Null when there is nothing to span.
 */
export function readingSpan(
  readings: Reading[],
  baselineDate?: string,
  targetDate?: string,
): { from: string; to: string } | null {
  const dates = [
    ...readings.map((r) => r.period),
    ...(baselineDate ? [baselineDate] : []),
    ...(targetDate ? [targetDate] : []),
  ]
    .filter(Boolean)
    .map((d) => d.slice(0, 7));
  if (dates.length === 0) return null;
  return {
    from: dates.reduce((a, b) => (a < b ? a : b)),
    to: dates.reduce((a, b) => (a > b ? a : b)),
  };
}

/**
 * The engine's periods, each carrying its reading when one exists. A
 * reading whose month is not the end of one of the periods is still
 * somebody's number: it is shown in its place rather than dropped.
 */
export function readingSlots(periods: CyclePeriod[], readings: Reading[]): Slot[] {
  const byPeriod = new Map(readings.map((r) => [r.period, r]));
  const slots: Slot[] = periods.map((p) => ({
    period: p.end,
    startsOn: p.start,
    ...(p.label ? { label: p.label } : {}),
    reading: byPeriod.get(p.end),
  }));
  const covered = new Set(slots.map((s) => s.period));
  for (const r of readings) {
    if (!covered.has(r.period)) slots.push({ period: r.period, startsOn: r.period, reading: r });
  }
  slots.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
  return slots;
}
