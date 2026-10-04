import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Hourglass, Repeat } from "lucide-react";

import { copy } from "@/copy";
import { NewDefinition } from "@/definition/NewDefinition";
import { ChoiceCard } from "@/components/ChoiceCard";
import { rememberWaiting } from "@/operations/waiting";

type Status = "planned" | "running";

export const Route = createFileRoute("/operations/new")({
  component: NewOperationPage,
  // Arriving from New's "No, it is new" starts a planned service
  // (TAXONOMY.md D30); anything else starts one that runs today.
  // From a project's placeholder, it also brings the name the placeholder
  // held and the project waiting on it (TAXONOMY.md D31).
  validateSearch: (search: Record<string, unknown>): { status?: Status; name?: string; for?: string } => ({
    ...(search.status === "planned" ? { status: "planned" as const } : {}),
    ...(typeof search.name === "string" && search.name ? { name: search.name } : {}),
    ...(typeof search.for === "string" && search.for ? { for: search.for } : {}),
  }),
});

/** A service, recorded where it is in its life: running today, as when an
 * organisation brings what it already runs into Cartograph, or planned,
 * written before the project that sets it up names it (TAXONOMY.md D30). */
function NewOperationPage() {
  const c = copy.operations.newOperation;
  const search = Route.useSearch();
  const [status, setStatus] = useState<Status>(search.status ?? "running");
  return (
    <NewDefinition
      kind="Operation"
      title={c.title}
      subtitle={c.subtitle}
      nameLabel={c.nameLabel}
      namePlaceholder={c.namePlaceholder}
      teamLabel={c.teamLabel}
      teamField="/spec/team"
      teamPlaceholder={c.teamPlaceholder}
      createLabel={c.create}
      errorLabel={c.generalError}
      specFrom={(_name, team) => ({ purpose: "", status, team })}
      firstStep="/operations/$id/service"
      initialName={search.name}
      onCreated={(id) => {
        if (search.for) rememberWaiting(id, search.for);
      }}
    >
      <fieldset className="flex flex-col gap-2" data-cartograph-field="/spec/status">
        <legend className="mb-2 text-sm font-medium">{c.statusQuestion}</legend>
        <div className="flex flex-col gap-2">
          <ChoiceCard icon={Repeat} title={c.running} detail={c.runningDetail} picked={status === "running"} onPick={() => setStatus("running")} />
          <ChoiceCard icon={Hourglass} title={c.planned} detail={c.plannedDetail} picked={status === "planned"} onPick={() => setStatus("planned")} />
        </div>
      </fieldset>
    </NewDefinition>
  );
}
