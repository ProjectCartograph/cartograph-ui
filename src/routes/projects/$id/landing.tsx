import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Help } from "@/components/guidance";
import { copy } from "@/copy";
import { PhaseShell } from "@/projects/PhaseShell";
import { useResourceNames } from "@/projects/RoleRefPicker";
import { LandingSection } from "@/projects/sections/LandingSection";
import { useSectionAutosave, useProjectStore } from "@/projects/store";
import { NEW_OPERATION_ID } from "@/projects/types";
import { type RefOption, useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

export const Route = createFileRoute("/projects/$id/landing")({ component: Page });

const lc = copy.projects.landing;

/** "Lands in" (card §2, Landing): a Combobox of Operation whose first
 * choice is "Define a new operation alongside" -- the manifest stores the
 * literal id "new", and this option list is the only place that ever maps
 * it to that label, so the field never shows the raw word "new" the way a
 * plain ReferenceField's own unknown-id fallback would. */
function LandsInField() {
  const store = useProjectStore();
  const { data } = useReferenceOptions("Operation");

  const options = useMemo<RefOption[]>(
    () => [{ value: NEW_OPERATION_ID, label: lc.defineNewOperation }, ...(data?.options ?? [])],
    [data],
  );
  return (
    <Combobox
      options={options}
      value={store.spec.operation || undefined}
      onValueChange={(next) => store.updateSpec((s) => ({ ...s, operation: next ?? "" }))}
      placeholder={lc.operationPlaceholder}
      emptyText={copy.sheets.dialog.noMatches}
      clearLabel={copy.common.clear}
      aria-label={lc.landsInTitle}
    />
  );
}

function LandingExtras() {
  useSectionAutosave();
  const store = useProjectStore();
  // The sponsor role's own title (I3.2: People and resources names roles,
  // never persons; mapping a role to an actual person happens later,
  // outside the definition).
  const sponsor = store.spec.resources?.find((r) => r.role === "sponsor");
  const resourceName = useResourceNames();

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <Label>{lc.landsInTitle}</Label>
          <Help label={lc.landsInTitle} hint={lc.landsInHint} />
        </div>
        <LandsInField />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{lc.confirmedByTitle}</Label>
        {sponsor ? (
          <p className="text-sm font-medium">
            {(sponsor.resource ? resourceName(sponsor.resource) : undefined) ||
              copy.projects.resources.sponsorLabel}
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
