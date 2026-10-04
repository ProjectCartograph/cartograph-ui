import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Help } from "@/components/guidance";
import { copy, plusNoun } from "@/copy";
import { ServiceAddDialog } from "@/operations/ServiceAddDialog";
import { PhaseShell } from "@/projects/PhaseShell";
import { useResourceNames } from "@/projects/RoleRefPicker";
import { LandingSection } from "@/projects/sections/LandingSection";
import { useSectionAutosave, useProjectStore } from "@/projects/store";
import { NEW_OPERATION_ID } from "@/projects/types";
import { type RefOption, useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

export const Route = createFileRoute("/projects/$id/landing")({ component: Page });

const lc = copy.projects.landing;

/**
 * "Lands in": the service that runs the result. A service that does not
 * run yet is added here as planned, then named, so the project lands in
 * something that exists (TAXONOMY.md D30). Projects saved before that
 * named the literal "new"; it still reads, under its own label, and is
 * offered to nobody else.
 */
function LandsInField() {
  const store = useProjectStore();
  const { data } = useReferenceOptions("Operation");
  const [adding, setAdding] = useState(false);
  const current = store.spec.operation || undefined;

  const options = useMemo<RefOption[]>(
    () => [...(current === NEW_OPERATION_ID ? [{ value: NEW_OPERATION_ID, label: lc.legacyNewOperation }] : []), ...(data?.options ?? [])],
    [data, current],
  );
  const set = (next?: string) => store.updateSpec((s) => ({ ...s, operation: next ?? "" }));
  return (
    <div className="flex items-center gap-2">
      <Combobox
        options={options}
        value={current}
        onValueChange={set}
        placeholder={lc.operationPlaceholder}
        emptyText={copy.sheets.dialog.noMatches}
        clearLabel={copy.common.clear}
        aria-label={lc.landsInTitle}
        data-cartograph-field="/spec/operation"
      />
      <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} aria-label={copy.operations.add.button}>
        <Plus />
        {plusNoun(copy.operations.add.button)}
      </Button>
      <ServiceAddDialog open={adding} onOpenChange={setAdding} onAdded={(id) => set(id)} />
    </div>
  );
}

function LandingExtras() {
  useSectionAutosave();
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
        <LandsInField />
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
