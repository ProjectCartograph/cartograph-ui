import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/programmes/ChecksAside";
import { ComponentsSection } from "@/programmes/sections/ComponentsSection";
import { PROGRAMME_STEPS } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/components")({ component: Page });

function Page() {
  const c = copy.programmes.sections.components;
  return (
    <DefinitionShell
      home="/programmes"
      steps={PROGRAMME_STEPS}
      current="components"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="components" />
          <ChecksAside section="components" />
        </>
      }
    >
      <ComponentsSection />
    </DefinitionShell>
  );
}
