import { WriteGate } from "@/access/WriteGate";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { DefinitionStoreProvider } from "@/definition/store";
import { blankKPISpec } from "@/kpis/types";

export const Route = createFileRoute("/kpis/$id")({ component: KPILayout });

/** The KPI's own definition. The readings step nests a second store for
 * the series, which is its own manifest beside this one (TAXONOMY.md D8). */
function KPILayout() {
  const { id } = Route.useParams();
  return (
    <DefinitionStoreProvider kind="KPI" id={id} blank={blankKPISpec}>
      <WriteGate kind="KPI" id={id}>
        <Outlet />
      </WriteGate>
    </DefinitionStoreProvider>
  );
}
