import { createFileRoute } from "@tanstack/react-router";

import { PreparePortfolioPage } from "@/projects/Prepare";

export const Route = createFileRoute("/portfolios/prepare")({ component: PreparePortfolioPage });
