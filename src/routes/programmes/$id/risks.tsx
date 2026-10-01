import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/programmes/ChecksAside";
import { RisksSection } from "@/programmes/sections/RisksSection";
import { PROGRAMME_STEPS } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/risks")({ component: Page });

function Page() {
  const c = copy.programmes.sections.risks;
  return (
    <DefinitionShell
      home="/programmes"
      steps={PROGRAMME_STEPS}
      current="risks"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="risks" />
          <ChecksAside section="risks" />
        </>
      }
    >
      <RisksSection />
    </DefinitionShell>
  );
}
