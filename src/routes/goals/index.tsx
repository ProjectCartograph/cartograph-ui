import { createFileRoute } from "@tanstack/react-router";

import { GoalsHome } from "@/surfaces/goals/GoalsHome";

export const Route = createFileRoute("/goals/")({ component: GoalsHome });
