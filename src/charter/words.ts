/** Words that are written in capitals wherever they appear. */
const ACRONYMS = new Set(["kpi", "kpis", "id", "raci", "url", "sla", "okr", "dmaic"]);

/** A contract value as a person reads it: "atClosing" as "At closing",
 * "kpi" as "KPI". A code already in capitals (a currency, USD) stays as
 * it is. */
export function wordsOf(value: string): string {
  if (/^[A-Z0-9]{2,}$/.test(value)) return value;
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase();
  const words = spaced.split(" ").map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w));
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
