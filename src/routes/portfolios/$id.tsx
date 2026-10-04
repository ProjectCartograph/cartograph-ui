import { createFileRoute } from "@tanstack/react-router";

import { PortfolioLayout } from "@/portfolios/pages";

export const Route = createFileRoute("/portfolios/$id")({ component: PortfolioLayout });
