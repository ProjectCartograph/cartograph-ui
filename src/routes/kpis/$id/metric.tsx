import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { DefinitionShell } from "@/definition/Shell";
import { SectionNotes } from "@/definition/SectionNotes";
import { MetricSection } from "@/kpis/sections/MetricSection";
import { KPI_STEPS } from "@/kpis/types";

export const Route = createFileRoute("/kpis/$id/metric")({ component: Page });

function Page() {
  const c = copy.kpis.metric;
  return (
    <DefinitionShell home="/kpis" steps={KPI_STEPS} current="metric" heading={c.heading} subtitle={c.subtitle} aside={<SectionNotes section="metric" />}>
      <MetricSection />
    </DefinitionShell>
  );
}
