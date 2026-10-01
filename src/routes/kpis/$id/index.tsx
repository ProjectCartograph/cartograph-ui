import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/kpis/$id/")({ component: Opening });

/** A KPI opened by its address alone lands on its first step, not a blank page. */
function Opening() {
  const { id } = Route.useParams();
  return <Navigate to="/kpis/$id/definition" params={{ id }} replace />;
}
