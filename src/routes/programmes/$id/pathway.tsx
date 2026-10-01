import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/programmes/ChecksAside";
import { PathwaySection } from "@/programmes/sections/PathwaySection";
import { PROGRAMME_STEPS } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/pathway")({ component: Page });

function Page() {
  const c = copy.programmes.sections.pathway;
  return (
    <DefinitionShell
      home="/programmes"
      steps={PROGRAMME_STEPS}
      current="pathway"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="pathway" />
          <ChecksAside section="pathway" />
        </>
      }
    >
      <PathwaySection />
    </DefinitionShell>
  );
}
