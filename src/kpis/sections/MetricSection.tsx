import { useQueries } from "@tanstack/react-query";
import { Divide, FunctionSquare, Sigma, TrendingUp, Trash2, type LucideIcon } from "lucide-react";

import { useClient } from "@/client/context";
import { FieldHeading } from "@/components/guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { METRIC_TYPES, type KPIDefinitionSpec, type KPIMetric, type MetricType, type SourceMetricRef } from "../types";

const mc = copy.kpis.metric;

const TYPE_ICON: Record<MetricType, LucideIcon> = { simple: Sigma, ratio: Divide, cumulative: TrendingUp, derived: FunctionSquare };

/**
 * How the indicator's number is computed (engine TAXONOMY.md D64): the
 * kind of metric as a tile, then the metric its data source gives, or one
 * out of another for a share. The sources say how each is counted; the
 * warehouse model behind them is set outside Cartograph.
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
  const offered = useSourceMetrics(sources);
  // Written whole, so the warehouse's terms an older definition carried
  // (measure, where, filter) go once a source metric is chosen.
  const write = (type: MetricType, of?: SourceMetricRef, outOf?: SourceMetricRef, window?: string) =>
    set({ type, ...(of ? { of } : {}), ...(type === "ratio" && outOf ? { outOf } : {}), ...(type === "cumulative" && window ? { window } : {}) });
  const pick = (type: MetricType) => {
    if (metric?.type === type) return;
    if (type === "derived") set({ type, uses: [], expr: "" });
    else write(type, metric?.of, metric?.outOf, metric?.window);
  };
  const legacy = !!metric && !metric.of && !!(metric.measure || metric.numerator);

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

      {metric ? <FormulaSentence metric={metric} names={kpis.data?.names} offered={offered} /> : null}
      {legacy ? <p className="text-sm text-muted-foreground" data-slot="kpi-metric-legacy">{mc.legacy}</p> : null}
      {metric && metric.type !== "derived" ? (
        <SourceMetricPicker
          label={metric.type === "ratio" ? mc.ofRatioLabel : mc.ofLabel}
          field="/spec/metric/of"
          value={metric.of}
          offered={offered}
          sources={sources}
          names={dataSources.data?.names}
          onChange={(of) => write(metric.type, of, metric.outOf, metric.window)}
        />
      ) : null}
      {metric?.type === "ratio" ? (
        <SourceMetricPicker
          label={mc.outOfLabel}
          field="/spec/metric/outOf"
          value={metric.outOf}
          offered={offered}
          sources={sources}
          names={dataSources.data?.names}
          onChange={(outOf) => write(metric.type, metric.of, outOf, metric.window)}
        />
      ) : null}
      {metric?.type === "cumulative" ? <WindowPicker value={metric.window} onChange={(window) => write("cumulative", metric.of, undefined, window)} /> : null}
      {metric?.type === "derived" ? (
        <DerivedBuilder self={store.id} metric={metric} options={(kpis.data?.options ?? []).filter((o) => o.value !== store.id)} onChange={patch} />
      ) : null}
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

const DERIVED_OPS = ["+", "-", "*", "/"] as const;
const UNITS = ["day", "week", "month", "quarter", "year"] as const;
const dbt = (id: string) => id.replace(/-/g, "_");

/** The formula, read back as a sentence from the source metrics chosen. */
function FormulaSentence({ metric, names, offered }: { metric: KPIMetric; names?: Map<string, string>; offered: OfferedMetric[] }) {
  const r = mc.reads;
  const what = (ref?: SourceMetricRef) => {
    const name = ref ? (offered.find((o) => sameRef(o.ref, ref))?.name ?? ref.metric) : "\u2026";
    return name.charAt(0).toLowerCase() + name.slice(1);
  };
  let text = "";
  if (metric.type === "simple") text = r.count(what(metric.of));
  else if (metric.type === "ratio") text = r.ratio(what(metric.of), what(metric.outOf));
  else if (metric.type === "cumulative") text = r.running(what(metric.of), windowWords(metric.window));
  else {
    const d = parseDerived(metric);
    if (d) text = r.derived(names?.get(d.a) ?? d.a, mc.derivedOps[d.op], names?.get(d.b) ?? d.b);
  }
  if (!text || metric.measure || metric.numerator) return null;
  return (
    <p className="rounded-lg bg-muted/50 p-3 text-sm text-pretty" data-cartograph-region="kpi-formula">
      <span className="text-xs text-muted-foreground">{mc.formula}: </span>
      {text}
      {text.endsWith("\u2026") ? "" : "."}
    </p>
  );
}

/** A metric one of the indicator's sources gives, as a picker offers it. */
interface OfferedMetric {
  ref: SourceMetricRef;
  name: string;
  aggregation: string;
}

const sameRef = (a: SourceMetricRef, b: SourceMetricRef) => a.dataSource === b.dataSource && a.metric === b.metric;

/** Every metric the indicator's sources give. */
function useSourceMetrics(sources: string[]): OfferedMetric[] {
  const client = useClient();
  const docs = useQueries({
    queries: sources.map((id) => ({ queryKey: ["source-metrics", id], queryFn: () => client.get("DataSource", id) })),
  });
  return docs.flatMap((q, i) => {
    const spec = (q.data?.manifest as { spec?: { metrics?: { id: string; name: string; aggregation: string }[] } } | undefined)?.spec;
    return (spec?.metrics ?? []).map((m) => ({ ref: { dataSource: sources[i], metric: m.id }, name: m.name, aggregation: m.aggregation }));
  });
}

/** One of the sources' metrics, picked by name, its aggregation beside it
 * so what is counted is read, not guessed. */
function SourceMetricPicker({ label, field, value, offered, sources, names, onChange }: { label: string; field: string; value?: SourceMetricRef; offered: OfferedMetric[]; sources: string[]; names?: Map<string, string>; onChange: (ref: SourceMetricRef) => void }) {
  const key = (r: SourceMetricRef) => `${r.dataSource}/${r.metric}`;
  const chosen = value ? offered.find((o) => sameRef(o.ref, value)) : undefined;
  const bare = sources.filter((s) => !offered.some((o) => o.ref.dataSource === s));
  return (
    <div className="flex flex-col gap-2" data-cartograph-field={field}>
      <FieldHeading label={label} hint={mc.sourceMetricHint} />
      {offered.length > 0 ? (
        <Select value={value ? key(value) : ""} onValueChange={(k) => onChange(offered.find((o) => key(o.ref) === k)!.ref)}>
          <SelectTrigger className="w-full sm:w-96" aria-label={label}>
            <SelectValue placeholder={mc.chooseMetric} />
          </SelectTrigger>
          <SelectContent>
            {offered.map((o) => (
              <SelectItem key={key(o.ref)} value={key(o.ref)}>
                {o.name}
                <span className="text-muted-foreground"> · {names?.get(o.ref.dataSource) ?? o.ref.dataSource}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {chosen ? <code className="self-start rounded bg-muted px-2 py-1 text-xs" data-slot="chosen-aggregation">{chosen.aggregation}</code> : null}
      {bare.map((s) => (
        <p key={s} className="text-xs text-muted-foreground">
          {mc.noMetrics(names?.get(s) ?? s)}
        </p>
      ))}
    </div>
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

