import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { ScopeSection } from "@/projects/sections/ScopeSection";

export const Route = createFileRoute("/projects/$id/initiation/scope")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell id={id} section="scope" heading={copy.projects.scope.heading} subtitle={copy.projects.scope.subtitle}>
      <ScopeSection />
    </InitiationShell>
  );
}
