import { createFileRoute } from "@tanstack/react-router";

import { startSearch } from "@/projects/start/search";
import { StartProjectRoute } from "@/projects/start/StartProjectRoute";

// Every project starts here, one question at a time, wherever it was
// begun (Home, New, Prepare, a planned service); ?from= walks a draft
// again.
export const Route = createFileRoute("/projects/start")({ component: StartProjectRoute, validateSearch: startSearch });
