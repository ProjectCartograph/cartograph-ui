import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "lucide-react";

import { Explorer } from "@/components/explorer/Explorer";
import { useKPIRows } from "@/components/explorer/registers";
import { copy } from "@/copy";

export const Route = createFileRoute("/kpis/")({ component: Page });

/** The register as a file explorer (components/explorer/Explorer.tsx). */
function Page() {
  const { rows, loading } = useKPIRows();
  return (
    <div className="flex flex-col gap-4">
      <Explorer
        title={copy.rail.kpis}
        icon={Gauge}
        rows={rows}
        loading={loading}
        route="/kpis/$id"
      />
    </div>
  );
}
