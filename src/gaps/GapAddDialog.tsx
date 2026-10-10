import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronRight } from "lucide-react";

import { useClient } from "@/client/context";
import { ClientError } from "@/client/port";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

const gd = copy.gapAdd;

/** An id of its own, never made from the name (engine AGENTS.md). */
function newGapId(): string {
  return `gap-${Math.random().toString(16).slice(2, 10).padEnd(8, "0")}`;
}

/**
 * A gap recorded in one screen (#31): its name, then the shortfall as it
 * is drawn, where things are now and where they should be side by side,
 * the groups it falls on, and the measure that shows it. The evidence's
 * own words wait under More. A gap noticed while writing a problem is
 * recorded without leaving it.
 */
export function GapAddDialog({
  open,
  onOpenChange,
  onAdded,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (id: string, name: string) => void;
  /** Values to start from: the groups the problem already names. */
  preset?: Record<string, unknown>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-cartograph-region="gap-add">
        <DialogHeader>
          <DialogTitle>{gd.title}</DialogTitle>
          <DialogDescription>{gd.hint}</DialogDescription>
        </DialogHeader>
        {open ? <GapForm preset={preset} onAdded={onAdded} close={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function GapForm({ preset, onAdded, close }: { preset?: Record<string, unknown>; onAdded?: (id: string, name: string) => void; close: () => void }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const { data: groups } = useReferenceOptions("BeneficiaryGroup");
  const [name, setName] = useState("");
  const [current, setCurrent] = useState("");
  const [desired, setDesired] = useState("");
  const [affects, setAffects] = useState<string[]>(Array.isArray(preset?.affects) ? (preset.affects as string[]) : []);
  const [measure, setMeasure] = useState<string | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [statement, setStatement] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const id = newGapId();
    const spec: Record<string, unknown> = {};
    if (current.trim()) spec.current = current.trim();
    if (desired.trim()) spec.desired = desired.trim();
    if (affects.length > 0) spec.affects = affects;
    if (measure) spec.measure = measure;
    if (statement.trim()) spec.statement = statement.trim();
    if (source.trim()) spec.source = source.trim();
    try {
      await client.saveVersion("Gap", id, { apiVersion: "cartograph/v1", kind: "Gap", metadata: { id, name: name.trim() }, spec }, gd.reason);
      void queryClient.invalidateQueries({ queryKey: ["sheet-ref-options", "Gap"] });
      void queryClient.invalidateQueries({ queryKey: ["sheet-summaries", "Gap"] });
      onAdded?.(id, name.trim());
      close();
    } catch (e) {
      setError(e instanceof ClientError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {gd.name}
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} maxLength={120} data-cartograph-field="/metadata/name" />
        <span className="text-xs font-normal text-muted-foreground">{gd.nameHint}</span>
      </label>
      {/* The shortfall, drawn as it is: from where things are to where
          they should be. */}
      <div className="grid items-start gap-2 sm:grid-cols-[1fr_auto_1fr]" data-cartograph-region="gap-shortfall">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {gd.current}
          <Textarea rows={2} value={current} onChange={(e) => setCurrent(e.target.value.slice(0, 200))} maxLength={200} className="text-sm text-foreground" data-cartograph-field="/spec/current" />
        </label>
        <ArrowRight className="mt-8 hidden size-5 text-muted-foreground sm:block" aria-hidden="true" />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {gd.desired}
          <Textarea rows={2} value={desired} onChange={(e) => setDesired(e.target.value.slice(0, 200))} maxLength={200} className="text-sm text-foreground" data-cartograph-field="/spec/desired" />
        </label>
      </div>
      {(groups?.options.length ?? 0) > 0 ? (
        <fieldset className="flex flex-col gap-1.5" data-cartograph-field="/spec/affects">
          <legend className="text-xs text-muted-foreground">{gd.affects}</legend>
          <div className="flex flex-wrap gap-1.5">
            {groups!.options.map((g) => {
              const on = affects.includes(g.value);
              return (
                <button
                  key={g.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAffects((a) => (on ? a.filter((x) => x !== g.value) : [...a, g.value]))}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm ring-1 ${on ? "bg-primary text-primary-foreground ring-primary" : "ring-foreground/15 hover:bg-muted"}`}
                >
                  {on ? <Check className="size-3.5" aria-hidden="true" /> : null}
                  {g.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {gd.measure}
        <ReferencePicker refKind="KPI" value={measure} onChange={setMeasure} label={gd.measure} data-cartograph-field="/spec/measure" />
      </div>
      <button type="button" className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground" aria-expanded={more} onClick={() => setMore((m) => !m)}>
        <ChevronRight className={`size-3.5 transition-transform ${more ? "rotate-90" : ""}`} aria-hidden="true" />
        {gd.more}
      </button>
      {more ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
            {gd.statement}
            <Textarea rows={2} value={statement} onChange={(e) => setStatement(e.target.value.slice(0, 400))} maxLength={400} className="text-sm text-foreground" data-cartograph-field="/spec/statement" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
            {gd.source}
            <Input value={source} onChange={(e) => setSource(e.target.value.slice(0, 240))} maxLength={240} className="text-sm text-foreground" data-cartograph-field="/spec/source" />
          </label>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={close}>
          {gd.cancel}
        </Button>
        <Button type="button" onClick={save} disabled={!name.trim() || saving}>
          <Check />
          {gd.save}
        </Button>
      </DialogFooter>
    </div>
  );
}
