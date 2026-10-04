import { createFileRoute } from "@tanstack/react-router";

import { PortfolioStep } from "@/portfolios/StepPage";
import { GovernanceSection } from "@/portfolios/sections/GovernanceSection";

export const Route = createFileRoute("/portfolios/$id/governance")({
  component: () => (
    <PortfolioStep section="governance">
      <GovernanceSection />
    </PortfolioStep>
  ),
});
