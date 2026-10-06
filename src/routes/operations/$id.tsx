import { WriteGate } from "@/access/WriteGate";
import { InChangeSet } from "@/changesets/InChangeSet";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DefinitionStoreProvider } from "@/definition/store";
import { blankOperationSpec } from "@/operations/types";

export const Route = createFileRoute("/operations/$id")({ component: OperationLayout });

function OperationLayout() {
  const { id } = Route.useParams();
  return (
    <InChangeSet>
      <DefinitionStoreProvider kind="Operation" id={id} blank={blankOperationSpec}>
        <WriteGate kind="Operation" id={id}>
          <Outlet />
        </WriteGate>
      </DefinitionStoreProvider>
    </InChangeSet>
  );
}
