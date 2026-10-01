import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Explorer } from "@/components/explorer/Explorer";
import { useProgrammeRows } from "@/components/explorer/registers";
import { copy } from "@/copy";

export const Route = createFileRoute("/programmes/")({ component: Page });

/** The register as a file explorer (components/explorer/Explorer.tsx). */
function Page() {
  const { rows, loading } = useProgrammeRows();
  return (
    <div className="flex flex-col gap-4">
      <Explorer
        title={copy.rail.programmes}
        icon={Layers}
        rows={rows}
        loading={loading}
        route="/programmes/$id"
        action={<Button asChild><Link to="/new">{copy.programmes.newLink}</Link></Button>}
      />
    </div>
  );
}
