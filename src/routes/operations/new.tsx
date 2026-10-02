import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { NewDefinition } from "@/definition/NewDefinition";

export const Route = createFileRoute("/operations/new")({ component: NewOperationPage });

function NewOperationPage() {
  const c = copy.operations.newOperation;
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
      specFrom={(_name, team) => ({ purpose: "", team })}
      firstStep="/operations/$id/service"
    />
  );
}
