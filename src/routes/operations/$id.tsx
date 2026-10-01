import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DefinitionStoreProvider } from "@/definition/store";
import { blankOperationSpec } from "@/operations/types";

export const Route = createFileRoute("/operations/$id")({ component: OperationLayout });

function OperationLayout() {
  const { id } = Route.useParams();
  return (
    <DefinitionStoreProvider kind="Operation" id={id} blank={blankOperationSpec}>
      <Outlet />
    </DefinitionStoreProvider>
  );
}
