import { useParams } from "@tanstack/react-router";

import { DefinitionStoreProvider, useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { StakeholderGrid } from "@/projects/StakeholderGrid";
import { groupsOf, type StakeholderEntry } from "@/projects/types";
import type { ProgrammeSpec } from "../types";
import { UnappliedBar } from "@/surfaces/sheet/Unapplied";

/** A programme's map lives under its own id, derived rather than stored,
 * the way a project's is. */
export function stakeholderMapID(programmeID: string): string {
  return `${programmeID}-stakeholders`.slice(0, 63);
}

interface MapSpec {
  scope?: { kind: string; id: string };
  entries?: StakeholderEntry[];
}

/**
 * Who holds power over this programme.
 *
 * TAXONOMY.md says a programme carries "a StakeholderMap scoped to it",
 * and until 2026-09-29 nothing could edit one: twenty-nine of them sat in
 * the plan vault with no surface at all.
 *
 * The map is a second manifest, so this step carries its own store nested
 * inside the programme's. Nothing here touches the programme itself, so
 * the two never contend: the inner store owns the map, and the step that
 * renders it is the only thing that asks.
 */
export function StakeholdersSection() {
  const { id } = useParams({ from: "/programmes/$id" });
  // Read before the map's own store is nested inside: the programme's
  // groups are offered first.
  const groups = groupsOf(useDefinitionStore<ProgrammeSpec>().spec);
  return (
    <DefinitionStoreProvider
      kind="StakeholderMap"
      id={stakeholderMapID(id)}
      blank={() => ({ scope: { kind: "Programme", id } }) as MapSpec}
    >
      <Grid programmeID={id} groups={groups} />
    </DefinitionStoreProvider>
  );
}

function Grid({ programmeID, groups }: { programmeID: string; groups: string[] }) {
  useSectionAutosave();
  const store = useDefinitionStore<MapSpec>();
  return (
    <div className="flex flex-col gap-4" data-cartograph-region="stakeholder-grid">
      {/* A map written straight into the vault is withheld like anything
          else, and this is the only screen that would notice. */}
      <UnappliedBar kind="StakeholderMap" />
      <StakeholderGrid
        entries={store.spec.entries ?? []}
        groups={groups}
        onChange={(next) =>
          store.updateSpec((m) => ({
            ...m,
            scope: m.scope ?? { kind: "Programme", id: programmeID },
            entries: next,
          }))
        }
      />
    </div>
  );
}
