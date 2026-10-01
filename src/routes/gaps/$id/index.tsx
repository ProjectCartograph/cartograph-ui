import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/gaps/$id/")({ component: Opening });

/** A gap opened by its address alone lands on its first step, not a blank page. */
function Opening() {
  const { id } = Route.useParams();
  return <Navigate to="/gaps/$id/shortfall" params={{ id }} replace />;
}
