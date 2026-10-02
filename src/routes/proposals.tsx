import { createFileRoute } from "@tanstack/react-router";

import { ProposalsPage } from "@/proposals/ProposalsPage";

export const Route = createFileRoute("/proposals")({ component: ProposalsPage });
