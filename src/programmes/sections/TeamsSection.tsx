import { ComboboxMultiple } from "@/components/ui/combobox";
import { EscalationRoute } from "@/components/EscalationRoute";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import type { ProgrammeSpec } from "../types";

const pc = copy.programmes;

/** Who runs it. Teams, never people: mapping a team to named individuals
 * is the delivery tool's job. */
export function TeamsSection() {
  useSectionAutosave();
  const store = useDefinitionStore<ProgrammeSpec>();
  const { data: teams } = useReferenceOptions("Team");
  const spec = store.spec;

  return (
    <div className="flex max-w-2xl flex-col gap-6" data-cartograph-region="governance">
      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.sponsorLabel} hint={pc.sponsorHint} />
        <ReferencePicker
          data-cartograph-field="/spec/sponsor"
          refKind="Resource"
          value={spec.sponsor}
          onChange={(v) => store.updateSpec((s) => ({ ...s, sponsor: v }))}
          label={pc.sponsorLabel}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.managerLabel} hint={pc.managerHint} />
        <ReferencePicker
          data-cartograph-field="/spec/manager"
          refKind="Resource"
          value={spec.manager}
          onChange={(v) => store.updateSpec((s) => ({ ...s, manager: v }))}
          label={pc.managerLabel}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.changeManagerLabel} hint={pc.changeManagerHint} />
        <ReferencePicker
          data-cartograph-field="/spec/businessChangeManager"
          refKind="Resource"
          value={spec.businessChangeManager}
          onChange={(v) => store.updateSpec((s) => ({ ...s, businessChangeManager: v }))}
          label={pc.changeManagerLabel}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.leadTeamLabel} />
        <ReferencePicker
          data-cartograph-field="/spec/leadTeam"
          refKind="Team"
          value={spec.leadTeam}
          onChange={(v) => store.updateSpec((s) => ({ ...s, leadTeam: v }))}
          label={pc.leadTeamLabel}
        />
      </div>
      <div className="flex flex-col gap-2">
        <FieldHeading label={pc.supportingTeamsLabel} />
        <ComboboxMultiple
          data-cartograph-field="/spec/supportingTeams"
          options={(teams?.options ?? []).filter((t) => t.value !== spec.leadTeam)}
          value={spec.supportingTeams ?? []}
          onValueChange={(next) =>
            store.updateSpec((s) => ({ ...s, supportingTeams: next.length > 0 ? next : undefined }))
          }
          emptyText={copy.sheets.dialog.noMatches}
          removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
          aria-label={pc.supportingTeamsLabel}
        />
      </div>
      <EscalationRoute
        value={spec.escalationRoute ?? []}
        onChange={(escalationRoute) => store.updateSpec((s) => ({ ...s, escalationRoute }))}
      />
    </div>
  );
}
