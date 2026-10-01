import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { RisksSection } from "@/projects/sections/RisksSection";

export const Route = createFileRoute("/projects/$id/initiation/risks")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell id={id} section="risks" heading={copy.projects.risks.heading} subtitle={copy.projects.risks.subtitle}>
      <RisksSection />
    </InitiationShell>
  );
}
