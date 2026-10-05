import { createFileRoute } from "@tanstack/react-router";

import { PrepareProgrammePage } from "@/projects/Prepare";

export const Route = createFileRoute("/programmes/prepare")({ component: PrepareProgrammePage });
