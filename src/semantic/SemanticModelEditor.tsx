import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

const sc = copy.semanticModel;

/** Where a data source's rows sit in the warehouse, as a dbt semantic
 * model (engine TAXONOMY.md D57). */
export interface SemanticModel {
  model: string;
  entity: string;
  key?: string;
  time?: { column: string; grain: Grain };
  dimensions?: { name: string; column?: string; segment?: string }[];
}

const GRAINS = ["day", "week", "month", "quarter", "year"] as const;
type Grain = (typeof GRAINS)[number];

/** A name as the warehouse and dbt take it. */
const ident = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64);

/**
 * The semantic model of a data source: the dbt model it is built on,
 * what one row is, the time each row is counted at, and the columns the
 * KPIs read from it may be split by, each naming its segment. Empty means
 * none, and the source is as complete as before.
 */
export function SemanticModelEditor({ value, onChange }: { value: SemanticModel | "" | undefined; onChange: (next: SemanticModel | undefined) => void }) {
  const segments = useReferenceOptions("Segment");
  const v: SemanticModel = value && typeof value === "object" ? value : { model: "", entity: "" };
  const set = (p: Partial<SemanticModel>) => {
    const next = { ...v, ...p };
    const empty = !next.model && !next.entity && !next.key && !next.time && !(next.dimensions ?? []).length;
    onChange(empty ? undefined : next);
  };
  const dims = v.dimensions ?? [];
  const setDim = (i: number, p: Partial<NonNullable<SemanticModel["dimensions"]>[number]>) => set({ dimensions: dims.map((d, j) => (j === i ? { ...d, ...p } : d)) });
  return (
    <div className="flex flex-col gap-3 rounded-lg p-3 ring-1 ring-foreground/10" data-cartograph-field="/spec/semanticModel">
      <div className="grid gap-3 sm:grid-cols-3">
        <Labelled label={sc.model} hint={sc.modelHint}>
          <Input value={v.model} onChange={(e) => set({ model: ident(e.target.value) })} aria-label={sc.model} className="font-mono" data-cartograph-field="/spec/semanticModel/model" />
        </Labelled>
        <Labelled label={sc.entity} hint={sc.entityHint}>
          <Input value={v.entity} onChange={(e) => set({ entity: ident(e.target.value) })} aria-label={sc.entity} className="font-mono" data-cartograph-field="/spec/semanticModel/entity" />
        </Labelled>
        <Labelled label={sc.key} hint={sc.keyHint}>
          <Input value={v.key ?? ""} onChange={(e) => set({ key: e.target.value || undefined })} aria-label={sc.key} className="font-mono" data-cartograph-field="/spec/semanticModel/key" />
        </Labelled>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Labelled label={sc.time} hint={sc.timeHint}>
          <Input
            value={v.time?.column ?? ""}
            onChange={(e) => set({ time: e.target.value ? { column: ident(e.target.value), grain: v.time?.grain ?? "day" } : undefined })}
            aria-label={sc.time}
            className="font-mono"
            data-cartograph-field="/spec/semanticModel/time/column"
          />
        </Labelled>
        <Labelled label={sc.grain}>
          <Select value={v.time?.grain ?? "day"} onValueChange={(g) => v.time && set({ time: { ...v.time, grain: g as Grain } })} disabled={!v.time}>
            <SelectTrigger aria-label={sc.grain} data-cartograph-field="/spec/semanticModel/time/grain">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRAINS.map((g) => (
                <SelectItem key={g} value={g}>
                  {sc.grains[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labelled>
      </div>
      <div className="flex flex-col gap-2" data-cartograph-field="/spec/semanticModel/dimensions">
        <span className="text-xs text-muted-foreground" title={sc.dimensionsHint}>
          {sc.dimensions}
        </span>
        {dims.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={d.name} onChange={(e) => setDim(i, { name: ident(e.target.value) })} aria-label={sc.dimensionName} className="font-mono" />
            <Input value={d.column ?? ""} onChange={(e) => setDim(i, { column: e.target.value || undefined })} aria-label={sc.dimensionColumn} className="font-mono" />
            <Select value={d.segment ?? "none"} onValueChange={(s) => setDim(i, { segment: s === "none" ? undefined : s })}>
              <SelectTrigger className="w-44" aria-label={sc.dimensionSegment}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{sc.noSegment}</SelectItem>
                {(segments.data?.options ?? []).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" onClick={() => set({ dimensions: dims.filter((_, j) => j !== i) })} aria-label={sc.removeDimension} title={sc.removeDimension}>
              <X />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set({ dimensions: [...dims, { name: "" }] })} aria-label={sc.addDimensionHint} title={sc.addDimensionHint}>
          <Plus />
          {sc.addDimension}
        </Button>
      </div>
    </div>
  );
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground" title={hint}>
      {label}
      {children}
    </label>
  );
}
