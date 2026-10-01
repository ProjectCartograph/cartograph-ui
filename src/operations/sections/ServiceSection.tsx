import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
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
          value={spec.name ?? store.name}
          onChange={(e) => {
            const v = e.target.value.slice(0, 160);
            store.setName(v);
            store.updateSpec((s) => ({ ...s, name: v }));
          }}
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
