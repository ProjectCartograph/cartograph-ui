import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { StakeholdersSection } from "@/projects/sections/StakeholdersSection";

export const Route = createFileRoute("/projects/$id/initiation/stakeholders")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const c = copy.projects.stakeholdersStep;
  return (
    <InitiationShell id={id} section="stakeholders" heading={c.heading} subtitle={c.subtitle}>
      <StakeholdersSection />
    </InitiationShell>
  );
}
