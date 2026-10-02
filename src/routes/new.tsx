import { createFileRoute } from "@tanstack/react-router";

import { NewWork } from "@/surfaces/new/NewWork";

// New leads in the order of work: the strategy from the purpose down,
// then the work that serves it (TAXONOMY.md D14, D28).
export const Route = createFileRoute("/new")({ component: NewWork });
