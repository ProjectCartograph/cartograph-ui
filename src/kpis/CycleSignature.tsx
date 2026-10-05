import { CalendarSync } from "lucide-react";

import { monthNames } from "@/components/locale";
import { copy } from "@/copy";
import { useCycle } from "./api";
import { periodsBetween } from "./periods";

/**
 * What the chosen cycle actually means, spelled out.
 *
 * Picking "Seasonal Cycle" tells you nothing about when a number is due.
 * The cycle knows — every three months, starting in September — and the
 * periods follow from that, so the reader can see them rather than work
 * them out (Programme Lead, 2026-09-29). The same idea as an editor
 * showing a function's signature when you reach for it: the definition,
 * where the decision is.
 */
export function CycleSignature({ id }: { id: string | undefined }) {
  const { data } = useCycle(id);
  const c = copy.kpis.cycleSignature;
  if (!id || !data || !data.periodMonths) return null;

  // A year of this cycle, so the months a reading is due read as examples
  // rather than as a rule somebody has to apply.
  const year = new Date().getUTCFullYear();
  const months = periodsBetween(data, `${year}-01`, `${year}-12`)
    .map((s) => s.period.slice(5))
    .slice(0, 12);

  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <CalendarSync className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {c.every(data.periodMonths)} {c.startingIn(monthName(data.startMonth))}
        {months.length > 0 ? ` ${c.periodsEnd(months.join(", "))}` : ""}
      </span>
    </p>
  );
}

// In the reader's language (components/locale).
const MONTHS = monthNames("long");

function monthName(n: number): string {
  return MONTHS[Math.min(Math.max(n, 1), 12) - 1];
}
