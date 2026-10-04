import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gauge, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Explorer } from "@/components/explorer/Explorer";
import { useKPIRows } from "@/components/explorer/registers";
import { copy, plusNoun } from "@/copy";
import { KPIAddDialog } from "@/kpis/KPIAddDialog";

export const Route = createFileRoute("/kpis/")({ component: Page });

/** The register as a file explorer (components/explorer/Explorer.tsx),
 * with its own new-item button, as every other register has. */
function Page() {
  const { rows, loading } = useKPIRows();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <Explorer
        title={copy.rail.kpis}
        icon={Gauge}
        rows={rows}
        loading={loading}
        route="/kpis/$id"
        action={
          <Button type="button" onClick={() => setAdding(true)} aria-label={copy.kpis.newLink}>
            <Plus />
            {plusNoun(copy.kpis.newLink)}
          </Button>
        }
      />
      <KPIAddDialog open={adding} onOpenChange={setAdding} onAdded={(id) => void navigate({ to: "/kpis/$id", params: { id } })} />
    </div>
  );
}
