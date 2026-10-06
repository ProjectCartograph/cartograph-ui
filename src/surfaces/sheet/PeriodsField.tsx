import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthNames } from "@/components/locale";
import { copy, plusNoun } from "@/copy";

/** One named period of a reporting cycle (TAXONOMY.md D40): it repeats
 * each year, ending in a month (endMonth), or happens once (end). */
export interface NamedPeriod {
  name: string;
  endMonth?: number;
  end?: string;
}

const pc = copy.sheets.periods;
const MONTHS = monthNames("long");

/**
 * A cycle's named periods: terms that repeat each year, listed in the
 * order the year runs, or survey waves dated once. Each is a name and the
 * month it ends; the engine lays the periods out from that.
 */
export function PeriodsField({
  value,
  onChange,
  pointer,
}: {
  value: NamedPeriod[];
  onChange: (next: NamedPeriod[]) => void;
  /** The list's own pointer, /spec/periods. */
  pointer: string;
}) {
  // A list is all one form, as the engine's rule holds it: the first
  // period says which, and the others follow.
  const once = value.length > 0 && value[0].end !== undefined;

  function update(idx: number, patch: Partial<NamedPeriod>) {
    onChange(value.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function setForm(nextOnce: boolean) {
    onChange(
      value.map((p) =>
        nextOnce ? { name: p.name, end: p.end ?? "" } : { name: p.name, endMonth: p.endMonth ?? 1 },
      ),
    );
  }

  return (
    <div className="flex flex-col gap-2" data-cartograph-field={pointer}>
      {value.length > 0 ? (
        <Select value={once ? "once" : "yearly"} onValueChange={(v) => setForm(v === "once")}>
          <SelectTrigger className="w-full" aria-label={pc.formLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yearly">{pc.yearly}</SelectItem>
            <SelectItem value="once">{pc.once}</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {value.map((p, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            data-cartograph-field={`${pointer}/${idx}/name`}
            value={p.name}
            onChange={(e) => update(idx, { name: e.target.value.slice(0, 40) })}
            aria-label={`${pc.nameLabel} ${idx + 1}`}
            maxLength={40}
            className="min-w-0 flex-1"
          />
          {once ? (
            <Input
              type="month"
              data-cartograph-field={`${pointer}/${idx}/end`}
              value={p.end ?? ""}
              onChange={(e) => update(idx, { end: e.target.value })}
              aria-label={`${pc.endLabel} ${idx + 1}`}
              className="w-40 shrink-0"
            />
          ) : (
            <Select value={String(p.endMonth ?? "")} onValueChange={(v) => update(idx, { endMonth: Number(v) })}>
              <SelectTrigger
                className="w-40 shrink-0"
                aria-label={`${pc.endMonthLabel} ${idx + 1}`}
                data-cartograph-field={`${pointer}/${idx}/endMonth`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => onChange(value.filter((_, i) => i !== idx))}
            aria-label={copy.projects.common.remove}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start border-dashed"
        onClick={() => onChange([...value, once ? { name: "", end: "" } : { name: "", endMonth: 1 }])}
        aria-label={pc.add}
      >
        <Plus />
        {plusNoun(pc.add)}
      </Button>
    </div>
  );
}
