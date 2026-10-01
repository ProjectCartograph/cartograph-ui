import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { SuccessSection } from "@/projects/sections/SuccessSection";

export const Route = createFileRoute("/projects/$id/initiation/success")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell
      id={id}
      section="success"
      heading={copy.projects.success.heading}
      subtitle={copy.projects.success.subtitle}
    >
      <SuccessSection />
    </InitiationShell>
  );
}
