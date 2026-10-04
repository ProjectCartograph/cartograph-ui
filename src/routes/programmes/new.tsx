import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { NewDefinition } from "@/definition/NewDefinition";

export const Route = createFileRoute("/programmes/new")({
  component: NewProgrammePage,
  // From the home page: the name of what was typed (engine docs/adr/0023).
  validateSearch: (search: Record<string, unknown>): { name?: string } =>
    typeof search.name === "string" && search.name ? { name: search.name } : {},
});

function NewProgrammePage() {
  const c = copy.programmes.newProgramme;
  return (
    <NewDefinition
      initialName={Route.useSearch().name}
      kind="Programme"
      title={c.title}
      subtitle={c.subtitle}
      nameLabel={c.nameLabel}
      namePlaceholder={c.namePlaceholder}
      teamLabel={c.teamLabel}
      teamField="/spec/leadTeam"
      teamPlaceholder={c.teamPlaceholder}
      createLabel={c.create}
      errorLabel={c.generalError}
      // The aim is left empty rather than guessed at: the first step asks
      // for it, and a placeholder written here would be an answer nobody
      // gave.
      specFrom={(_name, team) => ({ aim: { change: "" }, leadTeam: team })}
      firstStep="/programmes/$id/aim"
    />
  );
}
