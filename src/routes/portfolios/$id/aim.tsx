import { createFileRoute } from "@tanstack/react-router";

import { PortfolioStep } from "@/portfolios/StepPage";
import { AimSection } from "@/portfolios/sections/AimSection";

export const Route = createFileRoute("/portfolios/$id/aim")({
  component: () => (
    <PortfolioStep section="aim">
      <AimSection />
    </PortfolioStep>
  ),
});
