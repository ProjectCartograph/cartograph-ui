import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/programmes/ChecksAside";
import { ProblemsSection } from "@/programmes/sections/ProblemsSection";
import { PROGRAMME_STEPS } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/problems")({ component: Page });

function Page() {
  const c = copy.programmes.sections.problems;
  return (
    <DefinitionShell
      home="/programmes"
      steps={PROGRAMME_STEPS}
      current="problems"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="problems" />
          <ChecksAside section="problems" />
        </>
      }
    >
      <ProblemsSection />
    </DefinitionShell>
  );
}
