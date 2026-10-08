import { Divide, FunctionSquare, Sigma, TrendingUp, Trash2, type LucideIcon } from "lucide-react";

import { FieldHeading } from "@/components/guidance";
import { Button } from "@/components/ui/button";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { MEASURE_AGGS, METRIC_TYPES, type KPIDefinitionSpec, type KPIMeasure, type KPIMetric, type MetricType } from "../types";

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

      {metric && (metric.type === "simple" || metric.type === "cumulative") ? (
        <MeasureEditor label={mc.measureLabel} field="/spec/metric/measure" value={metric.measure} sources={sources} names={dataSources.data?.names} onChange={(measure) => patch({ measure })} />
      ) : null}
      {metric?.type === "ratio" ? (
        <>
          <MeasureEditor label={mc.numeratorLabel} field="/spec/metric/numerator" value={metric.numerator} sources={sources} names={dataSources.data?.names} onChange={(numerator) => patch({ numerator })} />
          <MeasureEditor label={mc.denominatorLabel} field="/spec/metric/denominator" value={metric.denominator} sources={sources} names={dataSources.data?.names} onChange={(denominator) => patch({ denominator })} />
        </>
      ) : null}
      {metric?.type === "cumulative" ? (
        <div className="flex flex-col gap-2">
          <FieldHeading label={mc.windowLabel} hint={mc.windowHint} />
          <Input className="w-48" value={metric.window ?? ""} onChange={(e) => patch({ window: e.target.value || undefined })} aria-label={mc.windowLabel} data-cartograph-field="/spec/metric/window" />
        </div>
      ) : null}
      {metric?.type === "derived" ? (
        <>
          <div className="flex flex-col gap-2">
            <FieldHeading label={mc.usesLabel} hint={mc.usesHint} />
            <ComboboxMultiple
              data-cartograph-field="/spec/metric/uses"
              options={(kpis.data?.options ?? []).filter((o) => o.value !== store.id)}
              value={metric.uses ?? []}
              onValueChange={(uses) => patch({ uses })}
              emptyText={mc.usesNone}
              removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
              aria-label={mc.usesLabel}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FieldHeading label={mc.exprLabel} hint={mc.exprHint} />
            <Input value={metric.expr ?? ""} onChange={(e) => patch({ expr: e.target.value })} aria-label={mc.exprLabel} data-cartograph-field="/spec/metric/expr" className="font-mono" />
          </div>
        </>
      ) : null}
      {metric ? (
        <div className="flex flex-col gap-2">
          <FieldHeading label={mc.filterLabel} hint={mc.filterHint} />
          <Input value={metric.filter ?? ""} onChange={(e) => patch({ filter: e.target.value || undefined })} aria-label={mc.filterLabel} data-cartograph-field="/spec/metric/filter" className="font-mono" />
        </div>
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

/** One measure: the source it is counted in (one of the KPI's own), how
 * the rows are added up, and the column added. */
function MeasureEditor({ label, field, value, sources, names, onChange }: { label: string; field: string; value?: KPIMeasure; sources: string[]; names?: Map<string, string>; onChange: (m: KPIMeasure) => void }) {
  const m: KPIMeasure = value ?? { source: sources[0] ?? "", agg: "count" };
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10" data-cartograph-field={field}>
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
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
        <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={mc.exprColumnHint}>
          {mc.exprColumnLabel}
          <Input value={m.expr ?? ""} onChange={(e) => onChange({ ...m, expr: e.target.value || undefined })} aria-label={`${label}: ${mc.exprColumnLabel}`} data-cartograph-field={`${field}/expr`} className="font-mono" />
        </label>
      </div>
    </fieldset>
  );
}
