import { ChipPicker } from "@/components/ChipPicker";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import type { OperationSpec } from "../types";

const oc = copy.operations;

/** The standing measures this service moves. An operation has no goals of
 * its own: what it is for is carried by the programmes it belongs to. */
export function MeasuresSection() {
  useSectionAutosave();
  const store = useDefinitionStore<OperationSpec>();
  const { data: kpis } = useReferenceOptions("KPI");

  return (
    <div data-cartograph-region="operation-measures" className="flex max-w-3xl flex-col gap-2">
      <FieldHeading label={oc.kpisLabel} />
      <ChipPicker
        data-cartograph-field="/spec/kpis"
        items={(kpis?.options ?? []).map((o) => ({ id: o.value, label: o.label }))}
        selected={store.spec.kpis ?? []}
        onToggle={(id) =>
          store.updateSpec((s) => {
            const next = (s.kpis ?? []).includes(id)
              ? (s.kpis ?? []).filter((k) => k !== id)
              : [...(s.kpis ?? []), id];
            return { ...s, kpis: next.length > 0 ? next : undefined };
          })
        }
        placeholder={copy.projects.goals.searchPlaceholder}
        empty={oc.kpisEmpty}
        slot="operation-kpi-chips"
      />
    </div>
  );
}
