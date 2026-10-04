import { createFileRoute } from "@tanstack/react-router";

import { PortfolioStep } from "@/portfolios/StepPage";
import { StrategySection } from "@/portfolios/sections/StrategySection";

export const Route = createFileRoute("/portfolios/$id/strategy")({
  component: () => (
    <PortfolioStep section="strategy">
      <StrategySection />
    </PortfolioStep>
  ),
});
