import { createFileRoute } from "@tanstack/react-router";

import { Label } from "@/components/ui/label";
import { Help } from "@/components/guidance";
import { copy } from "@/copy";
import { LandsInField } from "@/projects/LandsInField";
import { PhaseShell } from "@/projects/PhaseShell";
import { useResourceNames } from "@/projects/RoleRefPicker";
import { LandingSection } from "@/projects/sections/LandingSection";
import { useSectionAutosave, useProjectStore } from "@/projects/store";

export const Route = createFileRoute("/projects/$id/landing")({
  component: Page,
  // Back from defining the service a placeholder waited on: its id, to
  // name it here (TAXONOMY.md D31).
  validateSearch: (search: Record<string, unknown>): { resolve?: string } =>
    typeof search.resolve === "string" && search.resolve ? { resolve: search.resolve } : {},
});

const lc = copy.projects.landing;

function LandingExtras() {
  useSectionAutosave();
  const { resolve } = Route.useSearch();
  const store = useProjectStore();
  // The sponsor role's own title (I3.2: People and resources names roles,
  // never persons; mapping a role to an actual person happens later,
  // outside the definition).
  // The service owner accepts the handover (TAXONOMY.md D23), as the
  // engine's landing-owner check asks.
  const owner = store.spec.resources?.find((r) => r.role === "serviceOwner");
  const resourceName = useResourceNames();

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2" data-cartograph-region="landing-extras">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <Label>{lc.landsInTitle}</Label>
          <Help label={lc.landsInTitle} hint={lc.landsInHint} />
        </div>
        <LandsInField resolve={resolve} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{lc.confirmedByTitle}</Label>
        {owner ? (
          <p className="text-sm font-medium">
            {(owner.resource ? resourceName(owner.resource) : undefined) || copy.projects.resources.roleKind.serviceOwner}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{lc.confirmedByEmpty}</p>
        )}
      </div>
    </div>
  );
}

function Page() {
  const { id } = Route.useParams();
  return (
    <PhaseShell id={id} phase="landing" heading={lc.heading} subtitle={lc.subtitle}>
      <div className="flex flex-col gap-6">
        <LandingExtras />
        <LandingSection id={id} />
      </div>
    </PhaseShell>
  );
}
