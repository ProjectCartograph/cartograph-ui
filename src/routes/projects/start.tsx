import { createFileRoute } from "@tanstack/react-router";

import { StartProject } from "@/projects/start/StartProject";

export const Route = createFileRoute("/projects/start")({ component: StartProject });
