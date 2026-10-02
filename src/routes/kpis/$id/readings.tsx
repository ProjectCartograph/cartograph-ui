import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Help } from "@/components/guidance";
import { copy } from "@/copy";
import { DefinitionShell } from "@/definition/Shell";
import { DefinitionStoreProvider, useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { readingsID, useCycle } from "@/kpis/api";
import { readingSlots } from "@/kpis/periods";
import { ReadingChart } from "@/kpis/ReadingChart";
import { ReadingsTable } from "@/kpis/ReadingsTable";
import { type KPIReadingsSpec, blankReadings, knownBaseline } from "@/kpis/types";
import type { KPIDefinitionSpec } from "@/kpis/types";

export const Route = createFileRoute("/kpis/$id/readings")({ component: Page });

const kc = copy.kpis;

function Page() {
  const { id } = Route.useParams();
  const c = kc.sections.readings;
  return (
    <DefinitionShell
      home="/kpis"
      steps={[
        { section: "definition", label: kc.sections.definition.heading, to: "/kpis/$id/definition" },
        { section: "readings", label: c.heading, to: "/kpis/$id/readings" },
      ]}
      current="readings"
      heading={c.heading}
      subtitle={c.subtitle}
    >
      <Readings kpiID={id} />
    </DefinitionShell>
  );
}

/**
 * What this KPI has actually read.
 *
 * The series is its own manifest beside the definition, so this step
 * carries a second store nested inside the KPI's. The definition is read
 * from the outer one and never written here: what is measured is decided
 * on the step before, and this one is for the numbers.
 */
function Readings({ kpiID }: { kpiID: string }) {
  const definition = useDefinitionStore<KPIDefinitionSpec>();
  return (
    <DefinitionStoreProvider
      kind="KPIReadings"
      id={readingsID(kpiID)}
      blank={blankReadings(kpiID)}
    >
      <Series kpiID={kpiID} spec={definition.spec} />
    </DefinitionStoreProvider>
  );
}

function Series({ kpiID, spec }: { kpiID: string; spec: KPIDefinitionSpec }) {
  useSectionAutosave();
  const store = useDefinitionStore<KPIReadingsSpec>();
  const cycle = useCycle(spec.cycle);

  const readings = store.spec.readings ?? [];
  const slots = cycle.data
    ? readingSlots(cycle.data, readings, knownBaseline(spec.baseline)?.date, spec.target?.date)
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* What the definition already commits to, as marks rather than a
          paragraph. Changed on the step before, shown here. */}
      <div className="flex flex-wrap items-center gap-2">
        {spec.unit ? (
          <Badge variant="outline">
            <span className="truncate">{spec.unit}</span>
          </Badge>
        ) : null}
        {spec.direction ? (
          <Badge variant="outline">
            <span className="truncate">{kc.chart.direction[spec.direction] ?? spec.direction}</span>
          </Badge>
        ) : null}
        {cycle.data ? (
          <Badge variant="outline">
            <span className="truncate">{cycle.data.name}</span>
          </Badge>
        ) : null}
      </div>

      {cycle.data ? (
        <ReadingChart
          slots={slots}
          unit={spec.unit ?? ""}
          target={spec.target}
          baseline={knownBaseline(spec.baseline)}
          direction={spec.direction}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{kc.noCycle}</p>
      )}

      <section className="flex flex-col gap-2" data-cartograph-region="readings">
        <div className="flex items-center gap-1">
          <h2 className="text-sm font-semibold">{kc.readings.title}</h2>
          <Help label={kc.readings.title} hint={kc.readings.hint} />
        </div>
        <ReadingsTable
          slots={slots}
          unit={spec.unit ?? ""}
          onChange={(next) =>
            store.updateSpec((s) => ({
              ...s,
              kpi: kpiID,
              readings: next.length > 0 ? next : undefined,
            }))
          }
        />
      </section>
    </div>
  );
}
