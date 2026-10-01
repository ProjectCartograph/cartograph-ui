import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { AimSection } from "@/projects/sections/AimSection";

export const Route = createFileRoute("/projects/$id/initiation/aim")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell id={id} section="aim" heading={copy.projects.aim.heading} subtitle={copy.projects.aim.subtitle}>
      <AimSection />
    </InitiationShell>
  );
}
