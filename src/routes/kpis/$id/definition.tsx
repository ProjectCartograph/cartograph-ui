import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { DefinitionShell } from "@/definition/Shell";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionSection } from "@/kpis/sections/DefinitionSection";
import { KPI_STEPS } from "@/kpis/types";

export const Route = createFileRoute("/kpis/$id/definition")({ component: Page });

function Page() {
  const c = copy.kpis.sections.definition;
  return (
    <DefinitionShell
      home="/kpis"
      steps={KPI_STEPS}
      current="definition"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={<SectionNotes section="definition" />}
    >
      <DefinitionSection />
    </DefinitionShell>
  );
}
