import { Divide, FunctionSquare, Plus, Sigma, TrendingUp, Trash2, type LucideIcon } from "lucide-react";

import { FieldHeading } from "@/components/guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { MEASURE_AGGS, METRIC_TYPES, WHERE_OPS, type KPIDefinitionSpec, type KPIMeasure, type KPIMetric, type KPIWhere, type MetricType, type WhereOp } from "../types";

const mc = copy.kpis.metric;

const TYPE_ICON: Record<MetricType, LucideIcon> = { simple: Sigma, ratio: Divide, cumulative: TrendingUp, derived: FunctionSquare };

/**
 * How the KPI's number is computed, in the dbt semantic layer's terms
 * (engine TAXONOMY.md D57), so the analytics engineer builds it as it is
 * written here: the kind of metric as a tile, then what each needs, every
 * measure over one of the KPI's own sources.
 */
export function MetricSection() {
  useSectionAutosave();
  const store = useDefinitionStore<KPIDefinitionSpec>();
  const spec = store.spec;
  const metric = spec.metric;
  const sources = spec.sources ?? (spec.source ? [spec.source] : []);
  const dataSources = useReferenceOptions("DataSource");
  const kpis = useReferenceOptions("KPI");
  const set = (next: KPIMetric | undefined) => store.updateSpec((s) => ({ ...s, metric: next }));
  const patch = (p: Partial<KPIMetric>) => metric && set({ ...metric, ...p });
  const first: KPIMeasure | undefined = sources[0] ? { source: sources[0], agg: "count" } : undefined;
  const pick = (type: MetricType) => {
    if (metric?.type === type) return;
    const keep = metric?.filter ? { filter: metric.filter } : {};
    if (type === "ratio") set({ type, numerator: metric?.measure ?? first, denominator: first, ...keep });
    else if (type === "derived") set({ type, uses: [], expr: "", ...keep });
    else set({ type, measure: metric?.measure ?? metric?.numerator ?? first, ...keep });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6" data-cartograph-region="kpi-metric">
      {sources.length === 0 ? <p className="text-sm text-muted-foreground">{mc.noSources}</p> : null}
      <div className="flex flex-col gap-2">
        <FieldHeading label={mc.typeLabel} hint={mc.typeHint} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={mc.typeLabel} data-cartograph-field="/spec/metric/type">
          {METRIC_TYPES.map((t) => {
            const Icon = TYPE_ICON[t];
            const on = metric?.type === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => pick(t)}
                title={mc.types[t].hint}
                className={`flex flex-col items-start gap-1 rounded-lg p-3 text-left ring-1 transition-colors ${on ? "bg-primary/10 ring-primary" : "ring-foreground/10 hover:bg-muted"}`}
                data-metric-type={t}
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">{mc.types[t].label}</span>
                <span className="text-xs text-muted-foreground">{mc.types[t].hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {metric ? <FormulaSentence metric={metric} names={kpis.data?.names} /> : null}
      {metric && (metric.type === "simple" || metric.type === "cumulative") ? (
        <MeasureEditor label={mc.measureLabel} field="/spec/metric/measure" value={metric.measure} sources={sources} names={dataSources.data?.names} onChange={(measure) => patch({ measure })} />
      ) : null}
      {metric?.type === "ratio" ? (
        <>
          <MeasureEditor label={mc.numeratorLabel} field="/spec/metric/numerator" value={metric.numerator} sources={sources} names={dataSources.data?.names} onChange={(numerator) => patch({ numerator })} />
          <MeasureEditor label={mc.denominatorLabel} field="/spec/metric/denominator" value={metric.denominator} sources={sources} names={dataSources.data?.names} onChange={(denominator) => patch({ denominator })} />
        </>
      ) : null}
      {metric?.type === "cumulative" ? <WindowPicker value={metric.window} onChange={(window) => patch({ window })} /> : null}
      {metric?.type === "derived" ? (
        <DerivedBuilder self={store.id} metric={metric} options={(kpis.data?.options ?? []).filter((o) => o.value !== store.id)} onChange={patch} />
      ) : null}
      {metric && metric.type !== "derived" ? <WhereBuilder value={metric.where ?? []} onChange={(where) => patch({ where: where.length > 0 ? where : undefined })} /> : null}
      {metric ? <AnalystDetails metric={metric} onChange={patch} /> : null}
      {metric ? (
        <Button type="button" variant="ghost" className="self-start" onClick={() => set(undefined)} aria-label={mc.clearHint} title={mc.clearHint}>
          <Trash2 />
          {mc.clear}
        </Button>
      ) : null}
      <HoldingTheGain />
    </div>
  );
}

/** The values a reading must stay within, and what is done when one does
 * not (engine TAXONOMY.md D58): the specification limits and response plan
 * a DMAIC control plan asks for. */
function HoldingTheGain() {
  const store = useDefinitionStore<KPIDefinitionSpec>();
  const spec = store.spec;
  const hc = mc.hold;
  const limits = spec.specLimits ?? {};
  const setLimit = (k: "lower" | "upper", raw: string) => {
    const next = { ...limits, [k]: raw === "" ? undefined : Number(raw) };
    const empty = next.lower === undefined && next.upper === undefined;
    store.updateSpec((s) => ({ ...s, specLimits: empty ? undefined : next }));
  };
  const response = spec.response ?? { trigger: "", action: "" };
  const setResponse = (p: Partial<NonNullable<KPIDefinitionSpec["response"]>>) => {
    const next = { ...response, ...p };
    const empty = !next.trigger && !next.action && !next.by?.id && next.withinDays === undefined;
    store.updateSpec((s) => ({ ...s, response: empty ? undefined : next }));
  };
  return (
    <section className="flex flex-col gap-4 border-t pt-6" data-cartograph-region="kpi-hold">
      <FieldHeading label={hc.title} hint={hc.hint} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={hc.lowerHint}>
          {hc.lower}
          <Input type="number" value={limits.lower ?? ""} onChange={(e) => setLimit("lower", e.target.value)} aria-label={hc.lower} data-cartograph-field="/spec/specLimits/lower" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={hc.upperHint}>
          {hc.upper}
          <Input type="number" value={limits.upper ?? ""} onChange={(e) => setLimit("upper", e.target.value)} aria-label={hc.upper} data-cartograph-field="/spec/specLimits/upper" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={hc.triggerHint}>
        {hc.trigger}
        <Input value={response.trigger} onChange={(e) => setResponse({ trigger: e.target.value })} aria-label={hc.trigger} data-cartograph-field="/spec/response/trigger" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={hc.actionHint}>
        {hc.action}
        <Input value={response.action} onChange={(e) => setResponse({ action: e.target.value })} aria-label={hc.action} data-cartograph-field="/spec/response/action" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {hc.by}
          <ReferencePicker
            data-cartograph-field="/spec/response/by"
            refKind="Resource"
            value={response.by?.id}
            onChange={(v) => setResponse({ by: v ? { kind: "Resource", id: v } : undefined })}
            label={hc.by}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {hc.within}
          <Input
            type="number"
            min={0}
            value={response.withinDays ?? ""}
            onChange={(e) => setResponse({ withinDays: e.target.value === "" ? undefined : Number(e.target.value) })}
            aria-label={hc.within}
            data-cartograph-field="/spec/response/withinDays"
          />
        </label>
      </div>
    </section>
  );
}

/** One measure: the source it is counted in (one of the KPI's own), how
 * the rows are added up, and the column added. */
function MeasureEditor({ label, field, value, sources, names, onChange }: { label: string; field: string; value?: KPIMeasure; sources: string[]; names?: Map<string, string>; onChange: (m: KPIMeasure) => void }) {
  const m: KPIMeasure = value ?? { source: sources[0] ?? "", agg: "count" };
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10" data-cartograph-field={field}>
      <legend className="px-1 text-sm font-medium">{label}</legend>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={mc.countsHint}>
          {mc.countsLabel}
          <Input value={m.counts ?? ""} onChange={(e) => onChange({ ...m, counts: e.target.value.slice(0, 120) || undefined })} maxLength={120} aria-label={`${label}: ${mc.countsLabel}`} data-cartograph-field={`${field}/counts`} />
        </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {mc.sourceLabel}
          <Select value={m.source || undefined} onValueChange={(source) => onChange({ ...m, source })}>
            <SelectTrigger aria-label={`${label}: ${mc.sourceLabel}`} data-cartograph-field={`${field}/source`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {names?.get(s) ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {mc.aggLabel}
          <Select value={m.agg} onValueChange={(agg) => onChange({ ...m, agg: agg as KPIMeasure["agg"] })}>
            <SelectTrigger aria-label={`${label}: ${mc.aggLabel}`} data-cartograph-field={`${field}/agg`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEASURE_AGGS.map((a) => (
                <SelectItem key={a} value={a}>
                  {mc.aggs[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
    </fieldset>
  );
}

const DERIVED_OPS = ["+", "-", "*", "/"] as const;
const UNITS = ["day", "week", "month", "quarter", "year"] as const;
const dbt = (id: string) => id.replace(/-/g, "_");

/** The formula, read back as a sentence: what the choices below say,
 * checked by reading rather than by knowing dbt (engine TAXONOMY.md D63). */
function FormulaSentence({ metric, names }: { metric: KPIMetric; names?: Map<string, string> }) {
  const r = mc.reads;
  const what = (m?: KPIMeasure) => m?.counts?.trim() || "\u2026";
  let text = "";
  if (metric.type === "simple") text = r.count(what(metric.measure));
  else if (metric.type === "ratio") text = r.ratio(what(metric.numerator), what(metric.denominator));
  else if (metric.type === "cumulative") text = r.running(what(metric.measure), windowWords(metric.window));
  else {
    const d = parseDerived(metric);
    if (d) text = r.derived(names?.get(d.a) ?? d.a, mc.derivedOps[d.op], names?.get(d.b) ?? d.b);
  }
  const conds = (metric.where ?? []).filter((w) => w.input && w.value).map((w) => `${w.input} ${mc.ops[w.op]} ${w.value}`);
  if (!text) return null;
  return (
    <p className="rounded-lg bg-muted/50 p-3 text-sm text-pretty" data-cartograph-region="kpi-formula">
      <span className="text-xs text-muted-foreground">{mc.formula}: </span>
      {text}
      {conds.length > 0 ? r.where(conds.join("; ")) : ""}
      {text.endsWith("\u2026") && conds.length === 0 ? "" : "."}
    </p>
  );
}

function windowWords(w?: string): string {
  const m = w?.match(/^(\d+) (day|week|month|quarter|year)s?$/);
  return m ? `${m[1]} ${mc.units[m[2]]}` : "";
}

/** A running total's window, chosen as a number and a unit. */
function WindowPicker({ value, onChange }: { value?: string; onChange: (w: string | undefined) => void }) {
  const m = value?.match(/^(\d+) (day|week|month|quarter|year)s?$/);
  const n = m ? m[1] : "";
  const unit = m ? m[2] : "";
  const set = (count: string, u: string) => onChange(count && u ? `${count} ${u}${count === "1" ? "" : "s"}` : undefined);
  return (
    <fieldset className="flex flex-col gap-2" data-cartograph-field="/spec/metric/window">
      <legend className="text-sm font-medium">{mc.windowLabel}</legend>
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {mc.windowCount}
          <Input type="number" min={1} max={9999} className="w-24" value={n} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4), unit || "day")} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {mc.windowUnit}
          <Select value={unit} onValueChange={(u) => set(n || "1", u)}>
            <SelectTrigger className="w-32" aria-label={mc.windowUnit}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {mc.units[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            {mc.allTime}
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}

/** Which rows count, each condition built from its parts (D63). */
function WhereBuilder({ value, onChange }: { value: KPIWhere[]; onChange: (next: KPIWhere[]) => void }) {
  const patchAt = (i: number, p: Partial<KPIWhere>) => onChange(value.map((w, j) => (j === i ? { ...w, ...p } : w)));
  return (
    <fieldset className="flex flex-col gap-2" data-cartograph-field="/spec/metric/where">
      <legend className="text-sm font-medium">{mc.whereLabel}</legend>
      <p className="text-xs text-muted-foreground">{mc.whereHint}</p>
      {value.map((w, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            {mc.whereInput}
            <Input value={w.input} onChange={(e) => patchAt(i, { input: e.target.value.slice(0, 80) })} maxLength={80} data-cartograph-field={`/spec/metric/where/${i}/input`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {mc.whereOp}
            <Select value={w.op} onValueChange={(op) => patchAt(i, { op: op as WhereOp })}>
              <SelectTrigger className="w-36" aria-label={mc.whereOp} data-cartograph-field={`/spec/metric/where/${i}/op`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WHERE_OPS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {mc.ops[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex w-40 flex-col gap-1 text-xs text-muted-foreground">
            {mc.whereValue}
            <Input value={w.value} onChange={(e) => patchAt(i, { value: e.target.value.slice(0, 80) })} maxLength={80} data-cartograph-field={`/spec/metric/where/${i}/value`} />
          </label>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={copy.projects.common.remove} title={copy.projects.common.remove}>
            <Trash2 />
          </Button>
        </div>
      ))}
      {value.length < 5 ? (
        <Button type="button" variant="outline" size="sm" className="self-start border-dashed" onClick={() => onChange([...value, { input: "", op: "is", value: "" }])} aria-label={mc.whereAddHint} title={mc.whereAddHint}>
          <Plus />
          {mc.whereAdd}
        </Button>
      ) : null}
    </fieldset>
  );
}

/** A derived indicator as two of the others and how they combine; the
 * expression is written from the choices (D63). */
function parseDerived(metric: KPIMetric): { a: string; op: (typeof DERIVED_OPS)[number]; b: string } | undefined {
  const [a, b] = metric.uses ?? [];
  if (!a || !b) return undefined;
  const m = (metric.expr ?? "").match(/^\s*([a-z0-9_]+)\s*([-+*/])\s*([a-z0-9_]+)\s*$/);
  if (!m || m[1] !== dbt(a) || m[3] !== dbt(b)) return undefined;
  return { a, op: m[2] as (typeof DERIVED_OPS)[number], b };
}

function DerivedBuilder({ self, metric, options, onChange }: { self: string; metric: KPIMetric; options: { value: string; label: string }[]; onChange: (p: Partial<KPIMetric>) => void }) {
  const parsed = parseDerived(metric);
  const [a, b] = metric.uses ?? [];
  const op = parsed?.op ?? "-";
  const write = (na: string | undefined, nop: string, nb: string | undefined) =>
    onChange({ uses: [na, nb].filter((x): x is string => !!x && x !== self), expr: na && nb ? `${dbt(na)} ${nop} ${dbt(nb)}` : "" });
  const pickOne = (label: string, value: string | undefined, setTo: (v: string) => void) => (
    <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Select value={value ?? ""} onValueChange={setTo}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
  return (
    <fieldset className="flex flex-wrap items-end gap-2" data-cartograph-field="/spec/metric/uses">
      <legend className="mb-2 w-full text-sm font-medium">{mc.usesLabel}</legend>
      {pickOne(mc.derivedFirst, a, (v) => write(v, op, b))}
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {mc.derivedOp}
        <Select value={op} onValueChange={(v) => write(a, v, b)}>
          <SelectTrigger className="w-36" aria-label={mc.derivedOp}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DERIVED_OPS.map((o) => (
              <SelectItem key={o} value={o}>
                {mc.derivedOps[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {pickOne(mc.derivedSecond, b, (v) => write(a, op, v))}
    </fieldset>
  );
}

/** What the warehouse names: the columns, the filter, a written-out
 * expression. Folded, for whoever builds it there (D63). */
function AnalystDetails({ metric, onChange }: { metric: KPIMetric; onChange: (p: Partial<KPIMetric>) => void }) {
  const sides = (["measure", "numerator", "denominator"] as const).filter((k) => metric[k]);
  return (
    <details className="rounded-lg ring-1 ring-foreground/10" data-cartograph-region="kpi-analyst">
      <summary className="cursor-pointer px-3 py-2 text-sm text-muted-foreground">{mc.analyst}</summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        <p className="text-xs text-muted-foreground">{mc.analystHint}</p>
        {sides.map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground" title={mc.exprColumnHint}>
            {`${k === "denominator" ? mc.denominatorLabel : mc.measureLabel}: ${mc.exprColumnLabel}`}
            <Input
              value={metric[k]?.expr ?? ""}
              onChange={(e) => onChange({ [k]: { ...metric[k]!, expr: e.target.value || undefined } })}
              className="font-mono"
              data-cartograph-field={`/spec/metric/${k}/expr`}
            />
          </label>
        ))}
        {metric.type === "derived" ? (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={mc.exprHint}>
            {mc.exprLabel}
            <Input value={metric.expr ?? ""} onChange={(e) => onChange({ expr: e.target.value })} className="font-mono" data-cartograph-field="/spec/metric/expr" />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={mc.filterHint}>
          {mc.filterLabel}
          <Input value={metric.filter ?? ""} onChange={(e) => onChange({ filter: e.target.value || undefined })} className="font-mono" data-cartograph-field="/spec/metric/filter" />
        </label>
      </div>
    </details>
  );
}
