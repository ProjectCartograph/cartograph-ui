import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/operations/ChecksAside";
import { MeasuresSection } from "@/operations/sections/MeasuresSection";
import { OPERATION_STEPS } from "@/operations/types";

export const Route = createFileRoute("/operations/$id/measures")({ component: Page });

function Page() {
  const c = copy.operations.sections.measures;
  return (
    <DefinitionShell
      home="/operations"
      steps={OPERATION_STEPS}
      current="measures"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="measures" />
          <ChecksAside section="measures" />
        </>
      }
    >
      <MeasuresSection />
    </DefinitionShell>
  );
}
