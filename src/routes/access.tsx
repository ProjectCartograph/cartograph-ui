import { createFileRoute } from "@tanstack/react-router";

import { AccessPage } from "@/access/AccessPage";

export const Route = createFileRoute("/access")({ component: AccessPage });
