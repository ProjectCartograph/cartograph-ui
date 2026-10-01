import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/programmes/ChecksAside";
import { SectionNotes } from "@/definition/SectionNotes";
import { StakeholdersSection } from "@/programmes/sections/StakeholdersSection";
import { PROGRAMME_STEPS } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/stakeholders")({ component: Page });

function Page() {
  const c = copy.programmes.sections.stakeholders;
  return (
    <DefinitionShell
      home="/programmes"
      steps={PROGRAMME_STEPS}
      current="stakeholders"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="stakeholders" />
          <ChecksAside section="stakeholders" />
        </>
      }
    >
      <StakeholdersSection />
    </DefinitionShell>
  );
}
