import { useId, useState } from "react";

import { copy } from "@/copy";
import { periodLabel, type Slot } from "./periods";

/**
 * One KPI over time, against the bar it has to clear.
 *
 * A line, because the job is change over time and the periods are evenly
 * spaced. One series, so there is no legend: the heading already names it.
 * The target is a reference line rather than a second series, because it is
 * not a thing that was measured.
 *
 * Drawn as SVG rather than with a chart library: this interface carries
 * eleven runtime dependencies on purpose, and one line and one rule is not
 * worth a twelfth.
 *
 * A gap in the series is drawn as a gap. A period nobody has read is not a
 * zero, and joining across it would draw a line through a number nobody
 * has.
 */
export function ReadingChart({
  slots,
  unit,
  target,
  baseline,
  direction,
}: {
  slots: Slot[];
  unit: string;
  target?: { value: number; date: string };
  baseline?: { value: number; date: string };
  direction?: string;
}) {
  const clipID = useId();
  const [hover, setHover] = useState<number | null>(null);
  const c = copy.kpis.chart;

  const points = slots
    .map((s, i) => ({ i, slot: s, value: s.reading?.value }))
    .filter((p): p is { i: number; slot: Slot; value: number } => p.value !== undefined);

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{c.empty}</p>;
  }

  const W = 640;
  const H = 200;
  const PAD = { top: 16, right: 16, bottom: 28, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = [
    ...points.map((p) => p.value),
    ...(target ? [target.value] : []),
    ...(baseline ? [baseline.value] : []),
  ];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    // A flat series still needs a band to sit in, or it divides by zero.
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.1;
  lo -= pad;
  hi += pad;

  const x = (i: number) => PAD.left + (slots.length <= 1 ? plotW / 2 : (i / (slots.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  // Runs of consecutive read periods, so a gap stays a gap.
  const runs: { i: number; value: number }[][] = [];
  let run: { i: number; value: number }[] = [];
  for (const s of slots.map((slot, i) => ({ i, value: slot.reading?.value }))) {
    if (s.value === undefined) {
      if (run.length) runs.push(run);
      run = [];
      continue;
    }
    run.push({ i: s.i, value: s.value });
  }
  if (run.length) runs.push(run);

  const last = points[points.length - 1];
  const fmt = (v: number) => `${Number(v.toFixed(2))}${unit ? ` ${unit}` : ""}`;

  return (
    <figure className="flex flex-col gap-2" data-cartograph-region="reading-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={c.label(points.length, fmt(last.value))}
      >
        <defs>
          <clipPath id={clipID}>
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* Two gridlines and two labels: the band the numbers sit in. */}
        {[lo + pad, hi - pad].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {Number(v.toFixed(1))}
            </text>
          </g>
        ))}

        {/* The bar to clear. Dashed, because it was not measured. */}
        {target ? (
          <g clipPath={`url(#${clipID})`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(target.value)}
              y2={y(target.value)}
              className="stroke-foreground/40"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
            <text
              x={W - PAD.right}
              y={y(target.value) - 6}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {c.target} {Number(target.value)}
            </text>
          </g>
        ) : null}

        {runs.map((r, k) => (
          <polyline
            key={k}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={r.map((p) => `${x(p.i)},${y(p.value)}`).join(" ")}
          />
        ))}

        {points.map((p) => (
          <circle
            key={p.i}
            cx={x(p.i)}
            cy={y(p.value)}
            r={hover === p.i ? 5 : 3.5}
            className={
              p.slot.reading?.provisional
                ? "fill-background stroke-foreground"
                : "fill-foreground stroke-background"
            }
            strokeWidth={2}
          />
        ))}

        {/* Only the last point is labelled: a number on every point is a
            table pretending to be a chart. */}
        <text
          x={Math.min(x(last.i) + 8, W - PAD.right)}
          y={y(last.value) - 8}
          textAnchor={x(last.i) > W - 120 ? "end" : "start"}
          className="fill-foreground text-[11px] font-medium"
        >
          {fmt(last.value)}
        </text>

        {/* Hit targets wider than the marks, so hovering is not a test of aim. */}
        {slots.map((s, i) => (
          <rect
            key={s.period}
            x={x(i) - plotW / Math.max(slots.length, 1) / 2}
            y={PAD.top}
            width={plotW / Math.max(slots.length, 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          >
            <title>
              {periodLabel(s)}
              {s.reading ? ` — ${fmt(s.reading.value)}` : ` — ${c.unread}`}
            </title>
          </rect>
        ))}

        {/* First and last period, so the span is readable without a table. */}
        <text x={PAD.left} y={H - 8} className="fill-muted-foreground text-[10px]">
          {periodLabel(slots[0])}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {periodLabel(slots[slots.length - 1])}
        </text>
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        {baseline ? `${c.baseline} ${Number(baseline.value)} (${baseline.date}). ` : ""}
        {direction ? c.direction[direction] ?? "" : ""}
      </figcaption>
    </figure>
  );
}
