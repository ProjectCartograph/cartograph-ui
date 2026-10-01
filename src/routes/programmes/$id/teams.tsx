import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/programmes/ChecksAside";
import { TeamsSection } from "@/programmes/sections/TeamsSection";
import { PROGRAMME_STEPS } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/teams")({ component: Page });

function Page() {
  const c = copy.programmes.sections.teams;
  return (
    <DefinitionShell
      home="/programmes"
      steps={PROGRAMME_STEPS}
      current="teams"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="teams" />
          <ChecksAside section="teams" />
        </>
      }
    >
      <TeamsSection />
    </DefinitionShell>
  );
}
