import { createFileRoute } from "@tanstack/react-router";

import { ChangeSetsPage } from "@/changesets/ChangeSetsPage";

export const Route = createFileRoute("/changesets/")({ component: ChangeSetsPage });
