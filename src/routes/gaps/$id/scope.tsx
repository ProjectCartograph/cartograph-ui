import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { DefinitionShell } from "@/definition/Shell";
import { ChecksAside } from "@/gaps/ChecksAside";
import { GapCoveragePanel } from "@/gaps/Coverage";
import { ScopeSection } from "@/gaps/sections/ScopeSection";
import { GAP_STEPS } from "@/gaps/types";

export const Route = createFileRoute("/gaps/$id/scope")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const c = copy.gaps.sections.scope;
  return (
    <DefinitionShell
      home="/gaps"
      steps={GAP_STEPS}
      current="scope"
      heading={c.heading}
      subtitle={c.subtitle}
      aside={
        <>
          <ChecksAside section="scope" />
          <GapCoveragePanel id={id} />
        </>
      }
    >
      <ScopeSection />
    </DefinitionShell>
  );
}
