import { createFileRoute } from "@tanstack/react-router";

import { StrategyView } from "@/surfaces/goals/StrategyView";

// The strategy, read top-down (TAXONOMY.md D24); the goal board that edits
// it lives at /goals.
export const Route = createFileRoute("/strategy")({ component: StrategyView });
