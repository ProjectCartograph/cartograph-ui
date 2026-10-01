import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { SectionNotes } from "@/definition/SectionNotes";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/programmes/ChecksAside";
import { AimSection } from "@/programmes/sections/AimSection";
import { PROGRAMME_STEPS } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/aim")({ component: Page });

function Page() {
  const c = copy.programmes.sections.aim;
  return (
    <DefinitionShell
      home="/programmes"
      steps={PROGRAMME_STEPS}
      current="aim"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <SectionNotes section="aim" />
          <ChecksAside section="aim" />
        </>
      }
    >
      <AimSection />
    </DefinitionShell>
  );
}
