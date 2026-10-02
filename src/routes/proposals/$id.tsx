import { createFileRoute } from "@tanstack/react-router";

import { ProposalReviewPage } from "@/proposals/ProposalReviewPage";

export const Route = createFileRoute("/proposals/$id")({ component: ProposalPage });

function ProposalPage() {
  const { id } = Route.useParams();
  return <ProposalReviewPage id={id} />;
}
