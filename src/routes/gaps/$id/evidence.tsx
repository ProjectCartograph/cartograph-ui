import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/gaps/ChecksAside";
import { EvidenceSection } from "@/gaps/sections/EvidenceSection";
import { GAP_STEPS } from "@/gaps/types";

export const Route = createFileRoute("/gaps/$id/evidence")({ component: Page });

function Page() {
  const c = copy.gaps.sections.evidence;
  return (
    <DefinitionShell
      home="/gaps"
      steps={GAP_STEPS}
      current="evidence"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={<ChecksAside section="evidence" />}
    >
      <EvidenceSection />
    </DefinitionShell>
  );
}
