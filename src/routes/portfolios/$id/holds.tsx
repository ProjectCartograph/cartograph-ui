import { createFileRoute } from "@tanstack/react-router";

import { PortfolioStep } from "@/portfolios/StepPage";
import { HoldsSection } from "@/portfolios/sections/HoldsSection";

export const Route = createFileRoute("/portfolios/$id/holds")({
  component: () => (
    <PortfolioStep section="holds">
      <HoldsSection />
    </PortfolioStep>
  ),
});
