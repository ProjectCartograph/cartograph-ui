import { createFileRoute } from "@tanstack/react-router";

import { StagePage } from "@/projects/StagePage";

export const Route = createFileRoute("/projects/$id/initiation/beneficiaries")({
  component: () => <StagePage section="beneficiaries" />,
});
