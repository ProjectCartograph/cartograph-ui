import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { AlignmentSection } from "@/projects/sections/GoalsSection";

export const Route = createFileRoute("/projects/$id/initiation/goals")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell id={id} section="goals" heading={copy.projects.align.heading} subtitle={copy.projects.align.subtitle}>
      <AlignmentSection />
    </InitiationShell>
  );
}
