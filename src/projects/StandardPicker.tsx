import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";

const c = copy.projects.success.dialog;

/**
 * The bar a success criterion has to clear, picked rather than written.
 *
 * Most standards are a comparison and a number: at least 85 percent,
 * within 30 days. People asked for a dropdown where the old builder had
 * them write a clause and hoped it would read well (LSS_REVIEW.md, D19),
 * so the comparison is picked, the number is typed, and the unit is a
 * word or two. What is stored is the same short phrase as before, which is
 * why a standard that is not a number ("in every cluster review") still
 * has a home under "In words".
 */
export const COMPARISONS = ["atLeast", "atMost", "exactly", "within", "words"] as const;
export type Comparison = (typeof COMPARISONS)[number];

const PHRASE: Record<Exclude<Comparison, "words">, string> = {
  atLeast: "at least",
  atMost: "at most",
  exactly: "exactly",
  within: "within",
};

export interface Standard {
  comparison: Comparison;
  value: string;
  unit: string;
  words: string;
}

/** Reads a stored standard back into its parts. Anything that is not a
 * comparison, a number and a unit is kept whole, in words. */
export function parseStandard(stored: string): Standard {
  const s = stored.trim();
  const m = /^(at least|at most|exactly|within)\s+(\d+(?:[.,]\d+)?)\s*(.*)$/i.exec(s);
  if (!m) return { comparison: s ? "words" : "atLeast", value: "", unit: "", words: s };
  const comparison = (Object.keys(PHRASE) as (keyof typeof PHRASE)[]).find(
    (k) => PHRASE[k] === m[1].toLowerCase(),
  )!;
  return { comparison, value: m[2], unit: m[3].trim(), words: "" };
}

/** The stored phrase: fixed words around what was picked and typed, so
 * there is no grammar to guess. */
export function composeStandard(s: Standard): string {
  if (s.comparison === "words") return s.words.trim();
  if (!s.value.trim()) return "";
  return [PHRASE[s.comparison], s.value.trim(), s.unit.trim()].filter(Boolean).join(" ");
}

export function StandardPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const parts = parseStandard(value);
  const set = (patch: Partial<Standard>) => onChange(composeStandard({ ...parts, ...patch }));

  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="standard-picker">
      <Select
        value={parts.comparison}
        onValueChange={(v) => {
          const comparison = v as Comparison;
          // Moving between "in words" and a number carries the text over,
          // so nothing typed is lost by changing the dropdown.
          if (comparison === "words") set({ comparison, words: composeStandard(parts) });
          else set({ comparison, words: "" });
        }}
      >
        <SelectTrigger className="w-36" aria-label={c.standardLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMPARISONS.map((k) => (
            <SelectItem key={k} value={k}>
              {c.comparison[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {parts.comparison === "words" ? (
        <Input
          value={parts.words}
          onChange={(e) => set({ words: e.target.value.slice(0, 60) })}
          aria-label={c.standardWordsLabel}
          maxLength={60}
          className="min-w-48 flex-1"
        />
      ) : (
        <>
          <Input
            value={parts.value}
            onChange={(e) => set({ value: e.target.value.replace(/[^\d.,]/g, "").slice(0, 12) })}
            inputMode="decimal"
            aria-label={c.standardValueLabel}
            className="w-24"
          />
          <Input
            value={parts.unit}
            onChange={(e) => set({ unit: e.target.value.slice(0, 40) })}
            aria-label={c.standardUnitLabel}
            placeholder={c.standardUnitPlaceholder}
            className="w-44"
          />
        </>
      )}
    </div>
  );
}
