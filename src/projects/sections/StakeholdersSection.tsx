import { StakeholderGrid } from "../StakeholderGrid";
import { useProjectStore, useSectionAutosave } from "../store";
import { groupsOf } from "../types";

/**
 * Who holds power over this project, and how much.
 *
 * Its own step since 2026-09-29. It rode on Resources until the
 * stakeholder role was dropped from that list, and went with it — a
 * regression, because the two were only ever adjacent: resources are what
 * a project draws on to do the work, stakeholders are parties with an
 * interest in the outcome, and one is not a kind of the other.
 *
 * Scoring is stored on the StakeholderMap bound to this project, which the
 * project's own store already carries, so it rides the same debounce and
 * the same save as every other edit here.
 */
export function StakeholdersSection() {
  useSectionAutosave();
  const store = useProjectStore();
  return (
    <StakeholderGrid
      entries={store.mapSpec.entries ?? []}
      groups={groupsOf(store.spec)}
      onChange={(next) => store.updateMap((m) => ({ ...m, entries: next }))}
    />
  );
}
