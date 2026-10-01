import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Two calendar dropdowns, built from the stock Popover and Button so no
// date library enters the bundle: MonthPicker writes "yyyy-mm" (every
// month field in a definition: a baseline's as-of, a target's by, a
// timeline start) and DatePicker writes "yyyy-mm-dd" (a mandate's date).
// Both accept and keep a typed value that is not yet a valid date, so a
// person can still type; the popover only ever writes a valid one.

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseMonth(value: string | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

function parseDate(value: string | undefined): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** The trigger both pickers share: reads as a stock Input with a chevron,
 * shows the placeholder in muted text when there is no value. */
function PickerTrigger({
  value,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  placeholder: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? placeholder}
      className={cn(
        "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
        className,
      )}
    >
      <span className={cn("truncate tabular-nums", value ? "" : "text-muted-foreground")}>
        {value || placeholder}
      </span>
      <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function YearBar({ year, onChange }: { year: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous year" onClick={() => onChange(year - 1)}>
        <ChevronLeft />
      </Button>
      <span className="text-sm font-medium tabular-nums">{year}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Next year" onClick={() => onChange(year + 1)}>
        <ChevronRight />
      </Button>
    </div>
  );
}

/** A "yyyy-mm" field: a year stepper and the twelve months. */
export function MonthPicker({
  value,
  onChange,
  placeholder = "yyyy-mm",
  className,
  "aria-label": ariaLabel,
  "data-cartograph-field": field,
}: {
  value: string | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
}) {
  const parsed = parseMonth(value);
  const [open, setOpen] = React.useState(false);
  const [year, setYear] = React.useState(parsed?.year ?? new Date().getFullYear());

  React.useEffect(() => {
    if (open) setYear(parseMonth(value)?.year ?? new Date().getFullYear());
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("min-w-0", className)} data-cartograph-field={field}>
          <PickerTrigger value={value ?? ""} placeholder={placeholder} aria-label={ariaLabel} />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <YearBar year={year} onChange={setYear} />
        <div className="grid grid-cols-3 gap-1">
          {MONTHS_SHORT.map((label, idx) => {
            const isCurrent = parsed?.year === year && parsed?.month === idx + 1;
            return (
              <Button
                key={label}
                type="button"
                variant={isCurrent ? "default" : "ghost"}
                size="sm"
                aria-label={`${MONTHS[idx]} ${year}`}
                onClick={() => {
                  onChange(`${year}-${pad(idx + 1)}`);
                  setOpen(false);
                }}
              >
                {label}
              </Button>
            );
          })}
        </div>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Clear
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** How many days a month has, and which weekday (Monday = 0) it opens on. */
function monthGrid(year: number, month: number): { days: number; leading: number } {
  const days = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  return { days, leading: (firstWeekday + 6) % 7 };
}

/** A "yyyy-mm-dd" field: an ordinary month calendar. */
export function DatePicker({
  value,
  onChange,
  placeholder = "yyyy-mm-dd",
  className,
  "aria-label": ariaLabel,
  "data-cartograph-field": field,
}: {
  value: string | undefined;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  /** The manifest field this edits, by JSON pointer. */
  "data-cartograph-field"?: string;
}) {
  const parsed = parseDate(value);
  const [open, setOpen] = React.useState(false);
  const today = new Date();
  const [view, setView] = React.useState({
    year: parsed?.year ?? today.getFullYear(),
    month: parsed?.month ?? today.getMonth() + 1,
  });

  React.useEffect(() => {
    if (!open) return;
    const p = parseDate(value);
    setView({ year: p?.year ?? today.getFullYear(), month: p?.month ?? today.getMonth() + 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  function shiftMonth(by: number) {
    setView((prev) => {
      const total = prev.year * 12 + (prev.month - 1) + by;
      return { year: Math.floor(total / 12), month: (total % 12) + 1 };
    });
  }

  const { days, leading } = monthGrid(view.year, view.month);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("min-w-0", className)} data-cartograph-field={field}>
          <PickerTrigger value={value ?? ""} placeholder={placeholder} aria-label={ariaLabel} />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium">
            {MONTHS[view.month - 1]} {view.year}
          </span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => shiftMonth(1)}>
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: leading }).map((_, i) => (
            <span key={`lead-${i}`} />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const isCurrent = parsed?.year === view.year && parsed?.month === view.month && parsed?.day === day;
            return (
              <Button
                key={day}
                type="button"
                variant={isCurrent ? "default" : "ghost"}
                size="icon-sm"
                className="mx-auto tabular-nums"
                aria-label={`${day} ${MONTHS[view.month - 1]} ${view.year}`}
                onClick={() => {
                  onChange(`${view.year}-${pad(view.month)}-${pad(day)}`);
                  setOpen(false);
                }}
              >
                {day}
              </Button>
            );
          })}
        </div>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Clear
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
