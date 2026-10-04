import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { PhaseShell } from "@/projects/PhaseShell";
import { HandoverSection } from "@/projects/sections/HandoverSection";
import { LandingSection } from "@/projects/sections/LandingSection";

export const Route = createFileRoute("/projects/$id/landing")({
  component: Page,
  // Back from defining the service a placeholder waited on: its id, to
  // name it here (TAXONOMY.md D31).
  validateSearch: (search: Record<string, unknown>): { resolve?: string } =>
    typeof search.resolve === "string" && search.resolve ? { resolve: search.resolve } : {},
});

const lc = copy.projects.landing;

function Page() {
  const { id } = Route.useParams();
  return (
    <PhaseShell id={id} phase="landing" heading={lc.heading} subtitle={lc.subtitle}>
      <div className="flex flex-col gap-6">
        <HandoverSection resolve={Route.useSearch().resolve} />
        <LandingSection id={id} />
      </div>
    </PhaseShell>
  );
}
