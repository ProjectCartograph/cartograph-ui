import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { ResourcesSection } from "@/projects/sections/ResourcesSection";

export const Route = createFileRoute("/projects/$id/initiation/resources")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell id={id} section="resources" heading={copy.projects.resources.heading} subtitle={copy.projects.resources.subtitle}>
      <ResourcesSection />
    </InitiationShell>
  );
}
