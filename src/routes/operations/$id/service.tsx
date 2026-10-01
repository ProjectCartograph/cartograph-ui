import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/operations/ChecksAside";
import { ServiceSection } from "@/operations/sections/ServiceSection";
import { OPERATION_STEPS } from "@/operations/types";

export const Route = createFileRoute("/operations/$id/service")({ component: Page });

function Page() {
  const c = copy.operations.sections.service;
  return (
    <DefinitionShell
      home="/operations"
      steps={OPERATION_STEPS}
      current="service"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="service" />
          <ChecksAside section="service" />
        </>
      }
    >
      <ServiceSection />
    </DefinitionShell>
  );
}
