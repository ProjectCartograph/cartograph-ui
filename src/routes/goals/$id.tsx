import { createFileRoute } from "@tanstack/react-router";

import { GoalEditor } from "@/surfaces/goals/GoalEditor";

export const Route = createFileRoute("/goals/$id")({ component: GoalPage });

function GoalPage() {
  const { id } = Route.useParams();
  return <GoalEditor key={id} id={id} />;
}
