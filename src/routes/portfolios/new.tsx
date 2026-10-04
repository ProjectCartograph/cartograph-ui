import { createFileRoute } from "@tanstack/react-router";

import { NewPortfolioPage } from "@/portfolios/pages";

export const Route = createFileRoute("/portfolios/new")({
  component: NewPortfolioPage,
  // From the home page: the name of what was typed (engine docs/adr/0023).
  validateSearch: (search: Record<string, unknown>): { name?: string } =>
    typeof search.name === "string" && search.name ? { name: search.name } : {},
});
