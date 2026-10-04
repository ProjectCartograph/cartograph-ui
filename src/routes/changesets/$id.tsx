import { createFileRoute } from "@tanstack/react-router";

import { ChangeSetPage } from "@/changesets/ChangeSetPage";

export const Route = createFileRoute("/changesets/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  return <ChangeSetPage id={id} />;
}
