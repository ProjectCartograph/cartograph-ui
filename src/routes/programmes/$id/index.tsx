import { createFileRoute, Navigate } from "@tanstack/react-router";

/** A programme opens on its aim: everything else is read against what it
 * is for. */
export const Route = createFileRoute("/programmes/$id/")({ component: Opening });

function Opening() {
  const { id } = Route.useParams();
  return <Navigate to="/programmes/$id/aim" params={{ id }} replace />;
}
