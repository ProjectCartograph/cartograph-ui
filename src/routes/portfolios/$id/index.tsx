import { createFileRoute } from "@tanstack/react-router";

import { PortfolioOpening } from "@/portfolios/pages";

export const Route = createFileRoute("/portfolios/$id/")({ component: PortfolioOpening });
