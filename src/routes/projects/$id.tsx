import { WriteGate } from "@/access/WriteGate";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { ProjectStoreProvider } from "@/projects/store";

export const Route = createFileRoute("/projects/$id")({ component: ProjectLayout });

function ProjectLayout() {
  const { id } = Route.useParams();
  return (
    <ProjectStoreProvider id={id}>
      <WriteGate kind="Project" id={id}>
        <Outlet />
      </WriteGate>
    </ProjectStoreProvider>
  );
}
