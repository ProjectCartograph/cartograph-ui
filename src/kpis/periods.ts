/**
 * Which periods a KPI has, derived from the cycle it names.
 *
 * Nothing stores the list. A KPI names a ReportingCycle, and the cycle's
 * periodMonths and startMonth say what the periods are, so storing them
 * again beside the readings would be a second place to change the cycle
 * (TAXONOMY.md D8). A period with no reading is one nobody has read yet,
 * which is a state worth seeing rather than a zero.
 */

export interface Cycle {
  /** 1, 3, 6 or 12. */
  periodMonths: number;
  /** The month the first period of a year starts in, 1-12. */
  startMonth: number;
}

export interface Reading {
  period: string;
  value: number;
  provisional?: boolean;
  note?: string;
}

/** One period of the cycle, and the reading for it if there is one. */
export interface Slot {
  /** The month the period ends, as YYYY-MM. */
  period: string;
  /** The month it starts, for a label a person can read. */
  startsOn: string;
  reading?: Reading;
}

function toIndex(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return y * 12 + (m - 1);
}

function toYearMonth(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
}

/**
 * The periods between two months, as the cycle lays them out.
 *
 * A period is named by the month it *ends*, because that is when its number
 * exists: a quarter starting in January is not readable until March.
 * Periods are aligned to the cycle's own start month rather than to the
 * range, so the same cycle gives the same periods whatever is asked about
 * it — a financial year that starts in October starts in October.
 */
export function periodsBetween(cycle: Cycle, fromYearMonth: string, toYearMonthArg: string): Slot[] {
  const step = cycle.periodMonths;
  if (!step || step < 1) return [];
  const from = toIndex(fromYearMonth);
  const to = toIndex(toYearMonthArg);
  if (to < from) return [];

  // Walk back from the range's start to the first period boundary on or
  // before it, so the periods line up with the cycle and not with whenever
  // somebody happened to ask.
  const anchor = cycle.startMonth - 1; // 0-based month the cycle's year begins
  let start = from;
  while (((start % 12) - anchor + 12) % 12 !== 0) start -= 1;

  const out: Slot[] = [];
  for (let s = start; s <= to; s += step) {
    const end = s + step - 1;
    if (end < from) continue;
    out.push({ period: toYearMonth(end), startsOn: toYearMonth(s) });
  }
  return out;
}

/**
 * The cycle's periods across the span the KPI itself describes, each
 * carrying its reading when one exists.
 *
 * The span runs from the baseline to the target, because those are the two
 * dates the KPI already commits to; readings outside it are still shown, so
 * a number somebody recorded is never hidden by a target moving.
 */
export function readingSlots(
  cycle: Cycle,
  readings: Reading[],
  baselineDate?: string,
  targetDate?: string,
): Slot[] {
  const dates = [
    ...readings.map((r) => r.period),
    ...(baselineDate ? [baselineDate] : []),
    ...(targetDate ? [targetDate] : []),
  ].filter(Boolean);
  if (dates.length === 0) return [];
  const from = dates.reduce((a, b) => (a < b ? a : b));
  const to = dates.reduce((a, b) => (a > b ? a : b));

  const byPeriod = new Map(readings.map((r) => [r.period, r]));
  const slots = periodsBetween(cycle, from, to);
  for (const slot of slots) {
    slot.reading = byPeriod.get(slot.period);
  }
  // A reading whose period is not a period of the cycle is still somebody's
  // number. It is shown in its place rather than dropped.
  const covered = new Set(slots.map((s) => s.period));
  for (const r of readings) {
    if (!covered.has(r.period)) slots.push({ period: r.period, startsOn: r.period, reading: r });
  }
  slots.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
  return slots;
}
