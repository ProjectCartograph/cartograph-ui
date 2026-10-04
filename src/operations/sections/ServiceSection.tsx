import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferencing } from "@/operations/api";
import { STATUS_ICON, statusOf } from "@/operations/status";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import type { OperationSpec } from "../types";

const oc = copy.operations;

/** What the service is, who runs it, and when it is available. */
export function ServiceSection() {
  useSectionAutosave();
  const store = useDefinitionStore<OperationSpec>();
  const spec = store.spec;

  return (
    <div data-cartograph-region="operation-service" className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <FieldHeading label={oc.nameLabel} htmlFor="operation-name" />
        <Input
          data-cartograph-field="/metadata/name"
          id="operation-name"
          value={store.name}
          onChange={(e) => store.setName(e.target.value.slice(0, 160))}
          placeholder={oc.namePlaceholder}
          maxLength={160}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={oc.purposeLabel} hint={oc.purposeHint} htmlFor="operation-purpose" />
        <Textarea
          data-cartograph-field="/spec/purpose"
          id="operation-purpose"
          value={spec.purpose ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, purpose: e.target.value }))}
          placeholder={oc.purposePlaceholder}
          rows={3}
        />
      </div>
      <StatusField />
      <div className="flex flex-col gap-2">
        <FieldHeading label={oc.serviceOwnerLabel} hint={oc.serviceOwnerHint} />
        <ReferencePicker
          data-cartograph-field="/spec/serviceOwner"
          refKind="Resource"
          value={spec.serviceOwner}
          onChange={(v) => store.updateSpec((s) => ({ ...s, serviceOwner: v }))}
          label={oc.serviceOwnerLabel}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={oc.teamLabel} />
        <ReferencePicker
          data-cartograph-field="/spec/team"
          refKind="Team"
          value={spec.team}
          onChange={(v) => store.updateSpec((s) => ({ ...s, team: v }))}
          label={oc.teamLabel}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={oc.windowLabel} hint={oc.windowHint} htmlFor="operation-window" />
        <Input
          data-cartograph-field="/spec/serviceWindow"
          id="operation-window"
          value={spec.serviceWindow ?? ""}
          onChange={(e) =>
            store.updateSpec((s) => ({ ...s, serviceWindow: e.target.value || undefined }))
          }
          placeholder={oc.windowPlaceholder}
        />
      </div>
    </div>
  );
}

/**
 * Where the service is in its life (TAXONOMY.md D30): planned while the
 * project that sets it up is under way, running once in use, retired when
 * it stops. A planned service with no project yet offers to start that
 * project, which names the service as where it lands.
 */
function StatusField() {
  const store = useDefinitionStore<OperationSpec>();
  const status = statusOf(store.spec);
  const setUpBy = useReferencing("Operation", store.id, "Project");
  return (
    <div className="flex flex-col gap-2">
      <FieldHeading label={oc.status.label} hint={oc.statusHint} />
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={status}
          onValueChange={(next) => next && store.updateSpec((s) => ({ ...s, status: next as OperationSpec["status"] }))}
          aria-label={oc.status.label}
          data-cartograph-field="/spec/status"
        >
          {(["planned", "running", "retired"] as const).map((v) => {
            const Icon = STATUS_ICON[v];
            return (
              <ToggleGroupItem key={v} value={v} aria-label={oc.status[v]} className="gap-1.5">
                <Icon aria-hidden="true" />
                {oc.status[v]}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        {status === "planned" && setUpBy.data && setUpBy.data.length === 0 ? (
          <Button asChild size="sm" variant="outline" aria-label={oc.setUp}>
            <Link to="/projects/new" search={{ operation: store.id }} data-slot="set-up-project">
              <Plus />
              {oc.setUpShort}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
