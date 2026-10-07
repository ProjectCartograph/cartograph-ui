import { WriteGate } from "@/access/WriteGate";
import { InChangeSet } from "@/changesets/InChangeSet";
import { RecordDrawerProvider } from "@/records/RecordDrawer";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { ProjectStoreProvider } from "@/projects/store";

export const Route = createFileRoute("/projects/$id")({ component: ProjectLayout });

function ProjectLayout() {
  const { id } = Route.useParams();
  return (
    <InChangeSet>
      <ProjectStoreProvider id={id}>
        <WriteGate kind="Project" id={id}>
          <RecordDrawerProvider>
            <Outlet />
          </RecordDrawerProvider>
        </WriteGate>
      </ProjectStoreProvider>
    </InChangeSet>
  );
}
