import { Plus } from "lucide-react";
import { newRecordId } from "@/lib/recordId";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabelsEditor } from "@/components/LabelsEditor";
import { useClient } from "@/client/context";
import { ClientError } from "@/client/port";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { CycleSignature } from "./CycleSignature";
import { DidYouMean } from "@/components/DidYouMean";

const kc = copy.kpis;
const dc = kc.definition;

/** What a key result already says of the measure it is read by: its
 * figure today, its target and where it is read from. The two take the
 * same shapes, so a new indicator starts from them rather than asking
 * again (#87). */
export type KPISeed = { baseline?: unknown; target?: unknown; source?: string };

/**
 * A new measure, from inside the flow that wanted one.
 *
 * KPI is not a sheet kind — its baseline and target are objects where a
 * sheet's cells hold values — so the inline add every other register has
 * could not be the sheet dialog. This asks for exactly what the schema
 * requires plus the cycle, which is what decides the periods; the
 * baseline, the target and the readings are the measure's own page.
 */
export function KPIAddDialog({
  open,
  onOpenChange,
  onAdded,
  initialName,
  seed,
}: {
  open: boolean;
  seed?: KPISeed;
  /** A name to start from, as typed on the home page. */
  initialName?: string;
  onOpenChange: (open: boolean) => void;
  onAdded?: (id: string, name: string) => void;
}) {
  const queryClient = useQueryClient();
  const client = useClient();
  const [name, setName] = useState(initialName ?? "");
  const [definition, setDefinition] = useState("");
  const [unit, setUnit] = useState<string | undefined>();
  const [direction, setDirection] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>(seed?.source);
  const [cycle, setCycle] = useState<string | undefined>();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [refused, setRefused] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // The five the schema requires. Add stays live and marks what it is
  // waiting on, as everywhere else here.
  const ready = !!name.trim() && !!definition.trim() && !!unit && !!direction && !!source;

  // Escape or a click outside only closes: what was typed is there when
  // it opens again (#85). Cancel and a save clear it.
  function discard() {
    setName("");
    setDefinition("");
    setUnit(undefined);
    setDirection(undefined);
    setSource(seed?.source);
    setCycle(undefined);
    setLabels({});
    setRefused(false);
    setFailed(null);
    onOpenChange(false);
  }

  async function save() {
    if (!ready) {
      setRefused(true);
      return;
    }
    const id = newRecordId("KPI");
    const manifest = {
      apiVersion: "cartograph/v1",
      kind: "KPI",
      metadata: Object.keys(labels).length > 0 ? { id, name, labels } : { id, name },
      spec: {
        definition,
        unit,
        direction,
        sources: [source],
        ...(cycle ? { cycle } : {}),
        ...(seed?.baseline ? { baseline: seed.baseline } : {}),
        ...(seed?.target ? { target: seed.target } : {}),
      },
    };
    try {
      await client.saveVersion("KPI", id, manifest, kc.addReason);
    } catch (e) {
      if (!(e instanceof ClientError)) throw e;
      setFailed(kc.addFailed);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["manifests", "KPI"] });
    queryClient.invalidateQueries({ queryKey: ["sheet-ref-options", "KPI"] });
    queryClient.invalidateQueries({ queryKey: ["project-aim-kpis"] });
    onAdded?.(id, name);
    discard();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-cartograph-region="dialog-kpi-add">
        <DialogHeader>
          <DialogTitle>{kc.addTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kpi-new-name">{kc.nameLabel}</Label>
            <Input
              id="kpi-new-name"
              data-cartograph-field="/metadata/name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 160))}
              placeholder={kc.namePlaceholder}
              aria-invalid={refused && !name.trim()}
              maxLength={160}
            />
            {/* Already measured under another name: that one is handed
                back, as adding would. */}
            <DidYouMean
              kind="KPI"
              name={name}
              onUse={(m) => {
                onAdded?.(m.id, m.name);
                onOpenChange(false);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="kpi-new-definition">{dc.definitionLabel}</Label>
            <Textarea
              id="kpi-new-definition"
              data-cartograph-field="/spec/definition"
              rows={2}
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder={dc.definitionPlaceholder}
              aria-invalid={refused && !definition.trim()}
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex w-56 flex-col gap-2">
              <Label>{dc.unitLabel}</Label>
              <ReferencePicker
                refKind="Unit"
                data-cartograph-field="/spec/unit"
                value={unit}
                onChange={(v) => setUnit(v || undefined)}
                placeholder={dc.unitPlaceholder}
                label={dc.unitLabel}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dc.directionLabel}</Label>
              <Select value={direction ?? ""} onValueChange={setDirection}>
                <SelectTrigger className="w-48" aria-label={dc.directionLabel} data-cartograph-field="/spec/direction">
                  <SelectValue placeholder={dc.directionPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(kc.chart.direction).map(([value, text]) => (
                    <SelectItem key={value} value={value}>
                      {text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{dc.sourceLabel}</Label>
            <ReferencePicker
              refKind="DataSource"
              data-cartograph-field="/spec/source"
              value={source}
              onChange={(v) => setSource(v || undefined)}
              placeholder={dc.sourcePlaceholder}
              label={dc.sourceLabel}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{dc.cycleLabel}</Label>
            <ReferencePicker
              refKind="ReportingCycle"
              data-cartograph-field="/spec/cycle"
              value={cycle}
              onChange={(v) => setCycle(v || undefined)}
              placeholder={dc.cyclePlaceholder}
              label={dc.cycleLabel}
            />
            <CycleSignature id={cycle} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{copy.labels.label}</Label>
            <LabelsEditor labels={labels} onChange={setLabels} idPrefix="kpi-new-labels" />
          </div>

          {failed ? <p className="text-xs text-destructive">{failed}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={discard}>
            {kc.addCancel}
          </Button>
          <Button type="button" onClick={save}>
            <Plus />
            {kc.addSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
