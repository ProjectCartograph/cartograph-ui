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
import { slugify } from "@/surfaces/sheet/schema";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { CycleSignature } from "./CycleSignature";

const kc = copy.kpis;
const dc = kc.definition;

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (id: string, name: string) => void;
}) {
  const queryClient = useQueryClient();
  const client = useClient();
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [unit, setUnit] = useState<string | undefined>();
  const [direction, setDirection] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [cycle, setCycle] = useState<string | undefined>();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [refused, setRefused] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // The five the schema requires. Add stays live and marks what it is
  // waiting on, as everywhere else here.
  const ready = !!name.trim() && !!definition.trim() && !!unit && !!direction && !!source;

  function close(next: boolean) {
    if (!next) {
      setName("");
      setDefinition("");
      setUnit(undefined);
      setDirection(undefined);
      setSource(undefined);
      setCycle(undefined);
      setLabels({});
      setRefused(false);
      setFailed(null);
    }
    onOpenChange(next);
  }

  async function save() {
    if (!ready) {
      setRefused(true);
      return;
    }
    const id = slugify(name);
    const manifest = {
      apiVersion: "cartograph/v1",
      kind: "KPI",
      metadata: Object.keys(labels).length > 0 ? { id, name, labels } : { id, name },
      spec: { name, definition, unit, direction, source, ...(cycle ? { cycle } : {}) },
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
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
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
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            {kc.addCancel}
          </Button>
          <Button type="button" onClick={save}>
            {kc.addSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
