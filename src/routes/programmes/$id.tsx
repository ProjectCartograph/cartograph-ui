import { WriteGate } from "@/access/WriteGate";
import { InChangeSet } from "@/changesets/InChangeSet";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DefinitionStoreProvider } from "@/definition/store";
import { blankProgrammeSpec } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id")({ component: ProgrammeLayout });

function ProgrammeLayout() {
  const { id } = Route.useParams();
  return (
    <InChangeSet>
      <DefinitionStoreProvider kind="Programme" id={id} blank={blankProgrammeSpec}>
        <WriteGate kind="Programme" id={id}>
          <Outlet />
        </WriteGate>
      </DefinitionStoreProvider>
    </InChangeSet>
  );
}
