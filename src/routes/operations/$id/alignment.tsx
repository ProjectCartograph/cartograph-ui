import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/operations/ChecksAside";
import { AlignmentSection } from "@/operations/sections/AlignmentSection";
import { OPERATION_STEPS } from "@/operations/types";

export const Route = createFileRoute("/operations/$id/alignment")({ component: Page });

function Page() {
  const c = copy.operations.sections.alignment;
  return (
    <DefinitionShell
      home="/operations"
      steps={OPERATION_STEPS}
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
