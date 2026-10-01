import type { KeyResultKind } from "./types";

/**
 * The parts of a key result, and the one join the contract needs.
 *
 * Until 2026-09-29 this file also assembled the whole key result into a
 * sentence for the dialog and the card. It no longer does: a tool cannot
 * promise the grammar of a sentence it assembles, and the parts read on
 * their own (TAXONOMY.md D19).
 */

/** A number with the mark its kind carries: a percent wears its sign, and
 * every other kind carries its unit inside the metric itself. */
export function keyResultNumber(kind: KeyResultKind, value: number | string): string {
  return kind === "percent" ? `${value}%` : `${value}`;
}

/**
 * The metric is stored as one string and built from two parts: the unit,
 * already chosen above it, and the outcome word for what happens to them.
 * "deliveries" + "checked" is stored as "deliveries checked", so the
 * sentence never says the unit twice (Programme Lead, 2026-09-26).
 */
export function joinMetric(unit: string, outcome: string): string {
  const u = unit.trim();
  const o = outcome.trim();
  if (!u) return o;
  if (!o) return u;
  return `${u} ${o}`;
}

/** The outcome half of a stored metric, for an editor to put back in its
 * own field. A metric written elsewhere that does not start with the unit
 * is left whole, so nothing typed by hand is trapped or rewritten. */
export function splitMetric(metric: string, unit: string): string {
  const u = unit.trim();
  const m = metric.trim();
  if (!u) return m;
  const prefix = `${u.toLowerCase()} `;
  return m.toLowerCase().startsWith(prefix) ? m.slice(prefix.length) : m;
}

