import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";

const hc = copy.goals.editor.horizon;
const WHOLE = "whole";

function years(): string[] {
  const now = new Date().getFullYear();
  return Array.from({ length: 21 }, (_, i) => String(now - 5 + i));
}

export function splitEnd(v: string): { year: string; month: string } {
  return { year: v.slice(0, 4), month: v.length > 4 ? v.slice(5, 7) : WHOLE };
}

export function joinEnd(year: string, month: string): string {
  if (!year) return "";
  return month === WHOLE ? year : `${year}-${month}`;
}

/** One end of a horizon: a year, and a month when it matters. */
function End({
  label,
  value,
  onChange,
  field,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  field?: string;
}) {
  const { year, month } = splitEnd(value);
  return (
    <div className="flex items-center gap-2" data-cartograph-field={field}>
      <Select value={year} onValueChange={(y) => onChange(joinEnd(y, month))}>
        <SelectTrigger aria-label={`${label}: ${hc.year}`} className="w-24">
          <SelectValue placeholder={hc.year} />
        </SelectTrigger>
        <SelectContent>
          {years().map((y) => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year ? month : WHOLE} onValueChange={(m) => onChange(joinEnd(year, m))} disabled={!year}>
        <SelectTrigger aria-label={`${label}: ${hc.month}`} className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={WHOLE}>{hc.wholeYear}</SelectItem>
          {hc.months.map((name, i) => (
            <SelectItem key={name} value={String(i + 1).padStart(2, "0")}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The period an aim covers, picked rather than typed: a year at each end,
 * and a month only when it matters. Below a goal, "Same as above" clears
 * it so the aim takes its parent's.
 */
export function HorizonPicker({
  start,
  end,
  onChange,
  canInherit,
  inheritedSpan,
  "data-cartograph-field": field,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  canInherit: boolean;
  inheritedSpan?: string;
  /** The horizon object, by JSON pointer; its ends are /start and /end under it. */
  "data-cartograph-field"?: string;
}) {
  const own = start !== "" || end !== "";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-10 text-sm text-muted-foreground">{hc.fromWord}</span>
        <End label={hc.from} value={start} onChange={(v) => onChange(v, end)} field={field ? `${field}/start` : undefined} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-10 text-sm text-muted-foreground">{hc.toWord}</span>
        <End label={hc.until} value={end} onChange={(v) => onChange(start, v)} field={field ? `${field}/end` : undefined} />
      </div>
      {canInherit ? (
        own ? (
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange("", "")}>
            {hc.sameAsAbove}
          </Button>
        ) : inheritedSpan ? (
          <p className="text-sm text-muted-foreground">{hc.inherited(inheritedSpan)}</p>
        ) : null
      ) : null}
    </div>
  );
}
