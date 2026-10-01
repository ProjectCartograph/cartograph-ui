import { createFileRoute } from "@tanstack/react-router";

import { copy } from "@/copy";
import { NewDefinition } from "@/definition/NewDefinition";

export const Route = createFileRoute("/gaps/new")({ component: NewGapPage });

/**
 * A gap starts from the one thing it must have: the shortfall, in a
 * sentence. No team — a gap belongs to nobody, it is a finding about the
 * system, and asking who owns it invites a gap written as somebody's
 * missing budget line rather than as a short result.
 */
function NewGapPage() {
  const c = copy.gaps.newGap;
  return (
    <NewDefinition
      kind="Gap"
      title={c.title}
      subtitle={c.subtitle}
      nameLabel={c.nameLabel}
      namePlaceholder={c.namePlaceholder}
      createLabel={c.create}
      errorLabel={c.generalError}
      specFrom={() => ({})}
      firstStep="/gaps/$id/shortfall"
    />
  );
}
