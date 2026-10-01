import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { InitiationShell } from "@/projects/InitiationShell";
import { TimelineSection } from "@/projects/sections/TimelineSection";

export const Route = createFileRoute("/projects/$id/initiation/timeline")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return (
    <InitiationShell id={id} section="timeline" heading={copy.projects.timeline.heading} subtitle={copy.projects.timeline.subtitle}>
      <TimelineSection />
    </InitiationShell>
  );
}
