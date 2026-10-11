import { createFileRoute } from "@tanstack/react-router";

import { PrepareProgrammePage } from "@/projects/Prepare";

export const Route = createFileRoute("/programmes/prepare")({
  component: PrepareProgrammePage,
  // The idea typed before choosing (components/WhichKind).
  validateSearch: (search: Record<string, unknown>): { idea?: string } =>
    typeof search.idea === "string" && search.idea ? { idea: search.idea.slice(0, 1000) } : {},
});
