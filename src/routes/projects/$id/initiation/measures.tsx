import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { MeasuresSection } from "@/projects/sections/GoalsSection";

export const Route = createFileRoute("/projects/$id/initiation/measures")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell
      id={id}
      section="measures"
      heading={copy.projects.measures.heading}
      subtitle={copy.projects.measures.subtitle}
    >
      <MeasuresSection />
    </InitiationShell>
  );
}
