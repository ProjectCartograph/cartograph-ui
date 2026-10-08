import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gauge, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Explorer } from "@/components/explorer/Explorer";
import { useKPIRows } from "@/components/explorer/registers";
import { copy, plusNoun } from "@/copy";
import { KPIAddDialog } from "@/kpis/KPIAddDialog";
import { ExportSemantic } from "@/semantic/ExportSemantic";

export const Route = createFileRoute("/kpis/")({
  component: Page,
  // From the home page: open the add dialog with the name (engine docs/adr/0023).
  validateSearch: (search: Record<string, unknown>): { add?: string; name?: string } => ({
    ...(search.add ? { add: "1" } : {}),
    ...(typeof search.name === "string" && search.name ? { name: search.name } : {}),
  }),
});

/** The register as a file explorer (components/explorer/Explorer.tsx),
 * with its own new-item button, as every other register has. */
function Page() {
  const { rows, loading } = useKPIRows();
  const navigate = useNavigate();
  const arrived = Route.useSearch();
  const [adding, setAdding] = useState(!!arrived.add);
  return (
    <div className="flex flex-col gap-4">
      <Explorer
        title={copy.rail.kpis}
        icon={Gauge}
        rows={rows}
        loading={loading}
        route="/kpis/$id"
        action={
          <div className="flex items-center gap-2">
            <ExportSemantic />
            <Button type="button" onClick={() => setAdding(true)} aria-label={copy.kpis.newLink}>
              <Plus />
              {plusNoun(copy.kpis.newLink)}
            </Button>
          </div>
        }
      />
      <KPIAddDialog open={adding} onOpenChange={setAdding} initialName={arrived.name} onAdded={(id) => void navigate({ to: "/kpis/$id", params: { id } })} />
    </div>
  );
}
