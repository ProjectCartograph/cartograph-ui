import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { DataSection } from "@/projects/sections/DataSection";

export const Route = createFileRoute("/projects/$id/initiation/data")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell id={id} section="data" heading={copy.projects.data.heading} subtitle={copy.projects.data.subtitle}>
      <DataSection />
    </InitiationShell>
  );
}
