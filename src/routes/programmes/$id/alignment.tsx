import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/programmes/ChecksAside";
import { AlignmentSection } from "@/programmes/sections/AlignmentSection";
import { PROGRAMME_STEPS } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/alignment")({ component: Page });

function Page() {
  const c = copy.programmes.sections.alignment;
  return (
    <DefinitionShell
      home="/programmes"
      steps={PROGRAMME_STEPS}
      current="alignment"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="alignment" />
          <ChecksAside section="alignment" />
        </>
      }
    >
      <AlignmentSection />
    </DefinitionShell>
  );
}
