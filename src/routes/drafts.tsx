import { createFileRoute } from "@tanstack/react-router";

import { DraftsPage } from "@/changesets/DraftsPage";

export const Route = createFileRoute("/drafts")({ component: DraftsPage });
