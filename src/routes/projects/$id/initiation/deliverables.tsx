import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { DeliverablesSection } from "@/projects/sections/DeliverablesSection";

export const Route = createFileRoute("/projects/$id/initiation/deliverables")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell
      id={id}
      section="deliverables"
      heading={copy.projects.deliverables.heading}
      subtitle={copy.projects.deliverables.subtitle}
    >
      <DeliverablesSection />
    </InitiationShell>
  );
}
