import { CircleDashed } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { copy } from "@/copy";
import { periodLabel, type Reading, type Slot } from "./periods";

/**
 * One row per period the cycle has, whether or not anybody has read it.
 *
 * A period with no reading shows as empty rather than as a zero, because
 * "nobody has read this yet" and "it was nought" are different facts and a
 * chart that cannot tell them apart is worse than no chart. Typing a number
 * into an empty row is what creates the reading; clearing it removes it
 * again, so there is no way to leave a row that means nothing.
 */
export function ReadingsTable({
  slots,
  unit,
  onChange,
}: {
  slots: Slot[];
  unit: string;
  onChange: (next: Reading[]) => void;
}) {
  const c = copy.kpis.readings;

  function write(period: string, patch: Partial<Reading> | null) {
    const current = slots.flatMap((s) => (s.reading ? [s.reading] : []));
    if (patch === null) {
      onChange(current.filter((r) => r.period !== period));
      return;
    }
    const existing = current.find((r) => r.period === period);
    const next = existing
      ? current.map((r) => (r.period === period ? { ...r, ...patch } : r))
      : [...current, { period, value: 0, ...patch }];
    next.sort((a, b) => (a.period < b.period ? -1 : 1));
    onChange(next);
  }

  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">{c.noPeriods}</p>;
  }

  // A reading is named by its place among the readings held; a period
  // nobody has read yet is a new item.
  const held = slots.flatMap((s) => (s.reading ? [s.reading] : []));
  const pointer = (r: Reading | undefined) => `/spec/readings/${r ? held.indexOf(r) : "-"}`;

  return (
    <table className="w-full max-w-2xl text-sm" data-cartograph-region="readings-table">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-2 font-medium">{c.period}</th>
          <th className="py-2 font-medium">{c.value}</th>
          <th className="py-2 font-medium">{c.provisional}</th>
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => {
          const r = slot.reading;
          return (
            <tr key={slot.period} className="border-b last:border-0">
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  {r ? null : (
                    <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="truncate">{periodLabel(slot)}</span>
                </span>
              </td>
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <Input
                    data-cartograph-field={`${pointer(r)}/value`}
                    type="number"
                    className="h-8 w-28"
                    value={r?.value ?? ""}
                    aria-label={`${c.value} ${periodLabel(slot)}`}
                    onChange={(e) =>
                      e.target.value === ""
                        ? write(slot.period, null)
                        : write(slot.period, { value: Number(e.target.value) })
                    }
                  />
                  {unit ? (
                    <Badge variant="outline" className="font-normal">
                      <span className="truncate">{unit}</span>
                    </Badge>
                  ) : null}
                </span>
              </td>
              <td className="py-1.5">
                <Checkbox
                  data-cartograph-field={`${pointer(r)}/provisional`}
                  checked={Boolean(r?.provisional)}
                  disabled={!r}
                  aria-label={`${c.provisional} ${periodLabel(slot)}`}
                  onCheckedChange={(v) => write(slot.period, { provisional: v === true || undefined })}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
