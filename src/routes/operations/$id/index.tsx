import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/operations/$id/")({ component: Opening });

function Opening() {
  const { id } = Route.useParams();
  return <Navigate to="/operations/$id/service" params={{ id }} replace />;
}
