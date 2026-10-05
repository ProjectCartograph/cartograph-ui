import { createFileRoute } from "@tanstack/react-router";

import { PreparePage } from "@/projects/Prepare";

export const Route = createFileRoute("/projects/prepare")({
  component: PreparePage,
  validateSearch: (search: Record<string, unknown>): { partOf?: boolean } =>
    search.partOf === true || search.partOf === "true" ? { partOf: true } : {},
});
