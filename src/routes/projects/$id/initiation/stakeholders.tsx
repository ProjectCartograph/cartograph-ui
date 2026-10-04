import { createFileRoute } from "@tanstack/react-router";

import { StagePage } from "@/projects/StagePage";

export const Route = createFileRoute("/projects/$id/initiation/stakeholders")({
  component: () => <StagePage section="stakeholders" />,
});
