import { WriteGate } from "@/access/WriteGate";
import { InChangeSet } from "@/changesets/InChangeSet";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DefinitionStoreProvider } from "@/definition/store";
import { blankGapSpec } from "@/gaps/types";

export const Route = createFileRoute("/gaps/$id")({ component: GapLayout });

function GapLayout() {
  const { id } = Route.useParams();
  return (
    <InChangeSet>
      <DefinitionStoreProvider kind="Gap" id={id} blank={blankGapSpec}>
        <WriteGate kind="Gap" id={id}>
          <Outlet />
        </WriteGate>
      </DefinitionStoreProvider>
    </InChangeSet>
  );
}
