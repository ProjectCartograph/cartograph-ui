import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { PhaseShell } from "@/projects/PhaseShell";
import { ClosingSection } from "@/projects/sections/ClosingSection";

export const Route = createFileRoute("/projects/$id/closing")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <PhaseShell id={id} phase="closing" heading={copy.projects.closing.heading} subtitle={copy.projects.closing.subtitle}>
      <ClosingSection id={id} />
    </PhaseShell>
  );
}
