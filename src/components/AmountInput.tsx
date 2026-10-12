import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { grouped } from "./grouped";

const ac = copy.amount;

/** The units an amount may be typed in, each the multiplier it stands for. */
const SCALES = [1, 1_000, 1_000_000, 1_000_000_000] as const;

/** The largest unit the amount is a whole number of, so 42000 opens as 42
 * thousand rather than as five digits to count. */
function scaleOf(amount: number | undefined): number {
  if (!amount) return 1;
  for (const s of [...SCALES].reverse()) if (s > 1 && amount % s === 0) return s;
  return 1;
}

/**
 * An amount of money, typed in the unit that saves digits: 42 thousand
 * rather than 42000. The box groups its thousands as it is typed, and the
 * whole amount is said beneath it, so the figure is read rather than
 * counted. The stored value is the plain number either way.
 */
export function AmountInput({
  value,
  onChange,
  currency,
  label,
  disabled,
  field,
}: {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  currency?: string;
  label: string;
  disabled?: boolean;
  field?: string;
}) {
  const [scale, setScale] = useState(() => scaleOf(value));
  const shown = value === undefined ? "" : grouped(value / scale);
  const [text, setText] = useState<string | null>(null);
  const set = (raw: string, at = scale) => {
    const digits = raw.replace(/[^0-9.]/g, "");
    setText(digits === "" ? "" : groupedText(digits));
    onChange(digits === "" ? undefined : Number(digits) * at);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Input
          inputMode="decimal"
          value={text ?? shown}
          onChange={(e) => set(e.target.value)}
          onBlur={() => setText(null)}
          aria-label={label}
          disabled={disabled}
          className="min-w-0 flex-1 tabular-nums"
          data-cartograph-field={field}
        />
        <Select
          value={String(scale)}
          disabled={disabled}
          onValueChange={(v) => {
            const next = Number(v);
            setScale(next);
            // The figure typed stays; what it stands for changes.
            if (value !== undefined) onChange((value / scale) * next);
          }}
        >
          <SelectTrigger className="w-28 shrink-0" aria-label={ac.unitLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCALES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {ac.units[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value !== undefined && scale > 1 ? (
        <p className="text-xs tabular-nums text-muted-foreground" data-slot="amount-whole">
          {ac.whole(`${currency ? `${currency} ` : ""}${grouped(value)}`)}
        </p>
      ) : null}
    </div>
  );
}

/** Digits as typed, thousands grouped, a trailing point kept. */
function groupedText(digits: string): string {
  const [whole, frac] = digits.split(".");
  const w = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === undefined ? w : `${w}.${frac}`;
}
