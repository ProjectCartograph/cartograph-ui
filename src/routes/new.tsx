import { createFileRoute } from "@tanstack/react-router";

import { NewWork } from "@/surfaces/new/NewWork";

// New leads in the order of work: the strategy from the purpose down,
// then the work that serves it (TAXONOMY.md D14, D28).
export const Route = createFileRoute("/new")({
  component: NewWorkPage,
  // What was typed on Home, kept through "Not sure which?".
  validateSearch: (search: Record<string, unknown>): { text?: string } =>
    typeof search.text === "string" && search.text ? { text: search.text.slice(0, 2000) } : {},
});

function NewWorkPage() {
  return <NewWork text={Route.useSearch().text} />;
}
