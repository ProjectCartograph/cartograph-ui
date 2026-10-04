import { createFileRoute } from "@tanstack/react-router";

import { PortfoliosPage } from "@/portfolios/pages";

export const Route = createFileRoute("/portfolios/")({ component: PortfoliosPage });
