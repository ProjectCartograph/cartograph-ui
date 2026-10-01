import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/gaps/ChecksAside";
import { ShortfallSection } from "@/gaps/sections/ShortfallSection";
import { GAP_STEPS } from "@/gaps/types";

export const Route = createFileRoute("/gaps/$id/shortfall")({ component: Page });

function Page() {
  const c = copy.gaps.sections.shortfall;
  return (
    <DefinitionShell
      home="/gaps"
      steps={GAP_STEPS}
      current="shortfall"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={<ChecksAside section="shortfall" />}
    >
      <ShortfallSection />
    </DefinitionShell>
  );
}
