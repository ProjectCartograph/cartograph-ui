import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import { copy } from "@/copy";

const cc = copy.dmaic.chart;
const W = 640;
const H = 220;
const PAD = { l: 44, r: 16, t: 14, b: 28 };

/**
 * A KPI's readings as a control chart (engine TAXONOMY.md D58): the
 * engine's centre line and natural process limits, the specification
 * limits the KPI carries, each reading, and those that signal a change;
 * beneath, the process's capability against its specification.
 */
export function ControlChartView({ kpi }: { kpi: string }) {
  const client = useClient();
  const q = useQuery({ queryKey: ["control", kpi], queryFn: () => client.controlChart(kpi) });
  const c = q.data;
  if (!c || c.points.length < 2) {
    return c ? <p className="text-sm text-muted-foreground">{c.note ?? cc.few}</p> : null;
  }
  const values = [...c.points.map((p) => p.value), c.lower, c.upper, ...(c.specLower !== undefined ? [c.specLower] : []), ...(c.specUpper !== undefined ? [c.specUpper] : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
  const x = (i: number) => PAD.l + (i / Math.max(1, c.points.length - 1)) * (W - PAD.l - PAD.r);
  const line = (v: number, colour: string, dash: string, label: string) => (
    <g>
      <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={colour} strokeDasharray={dash} strokeWidth={1.25} />
      <text x={PAD.l - 4} y={y(v) + 3} fontSize="10" textAnchor="end" fill={colour}>
        {label}
      </text>
    </g>
  );
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));
  return (
    <figure className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-cartograph-region="control-chart">
      <figcaption className="flex flex-col">
        <span className="font-medium">{cc.title}</span>
        <span className="text-sm text-muted-foreground">{cc.hint}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={cc.label}>
        {line(c.upper, "var(--color-muted-foreground)", "4 3", fmt(c.upper))}
        {line(c.centre, "var(--color-primary)", "", fmt(c.centre))}
        {line(c.lower, "var(--color-muted-foreground)", "4 3", fmt(c.lower))}
        {c.specLower !== undefined ? line(c.specLower, "var(--color-warning)", "1 3", fmt(c.specLower)) : null}
        {c.specUpper !== undefined ? line(c.specUpper, "var(--color-warning)", "1 3", fmt(c.specUpper)) : null}
        <polyline points={c.points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} fill="none" stroke="var(--color-foreground)" strokeOpacity=".5" strokeWidth={1.25} />
        {c.points.map((p, i) => (
          <g key={p.period} data-signal={(p.signals ?? []).join(" ") || undefined}>
            <circle cx={x(i)} cy={y(p.value)} r={(p.signals ?? []).length ? 4.5 : 3} fill={(p.signals ?? []).length ? "var(--color-destructive)" : p.provisional ? "var(--color-background)" : "var(--color-foreground)"} stroke="var(--color-foreground)" strokeWidth={1}>
              <title>{`${p.period}: ${p.value}${(p.signals ?? []).length ? ` (${(p.signals ?? []).map((s) => cc.signals[s]).join(", ")})` : ""}`}</title>
            </circle>
            <text x={x(i)} y={H - 10} fontSize="10" textAnchor="middle" fill="var(--color-muted-foreground)">
              {p.period}
            </text>
          </g>
        ))}
      </svg>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">{cc.stable}</dt>
          <dd>{c.stable ? cc.yes : cc.no}</dd>
        </div>
        {c.cpk !== undefined ? (
          <div className="flex gap-1.5" title={cc.cpkHint}>
            <dt className="text-muted-foreground">Cpk</dt>
            <dd className="tabular-nums">{c.cpk}</dd>
          </div>
        ) : null}
        {c.cp !== undefined ? (
          <div className="flex gap-1.5" title={cc.cpHint}>
            <dt className="text-muted-foreground">Cp</dt>
            <dd className="tabular-nums">{c.cp}</dd>
          </div>
        ) : null}
        {c.sigmaLevel !== undefined ? (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">{cc.sigma}</dt>
            <dd className="tabular-nums">{c.sigmaLevel}</dd>
          </div>
        ) : null}
      </dl>
      {c.note ? <p className="text-xs text-muted-foreground">{c.note}</p> : null}
      {c.cpk === undefined ? <p className="text-xs text-muted-foreground">{cc.noSpec}</p> : null}
    </figure>
  );
}
