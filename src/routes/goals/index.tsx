import { createFileRoute } from "@tanstack/react-router";

import { GoalsPage } from "@/surfaces/goals/GoalsPage";
import type { GoalLevel } from "@/surfaces/goals/types";

const LEVELS: readonly string[] = ["goal", "objective", "outcome"];

export const Route = createFileRoute("/goals/")({
  component: GoalsPage,
  // From the home page: a level and a name to place (engine docs/adr/0023).
  validateSearch: (search: Record<string, unknown>): { add?: GoalLevel; name?: string } => ({
    ...(typeof search.add === "string" && LEVELS.includes(search.add) ? { add: search.add as GoalLevel } : {}),
    ...(typeof search.name === "string" && search.name ? { name: search.name } : {}),
  }),
});
