import { WriteGate } from "@/access/WriteGate";
import { InChangeSet } from "@/changesets/InChangeSet";
import { createFileRoute } from "@tanstack/react-router";

import { GoalEditor } from "@/surfaces/goals/GoalEditor";

export const Route = createFileRoute("/goals/$id")({
  component: GoalPage,
  // A check on another aim sends its fix here: the section to open.
  validateSearch: (search: Record<string, unknown>): { fix?: string } =>
    typeof search.fix === "string" && search.fix ? { fix: search.fix } : {},
});

function GoalPage() {
  const { id } = Route.useParams();
  const { fix } = Route.useSearch();
  return (
    <InChangeSet>
      <WriteGate kind="Goal" id={id}>
        <GoalEditor key={id} id={id} fix={fix} />
      </WriteGate>
    </InChangeSet>
  );
}
