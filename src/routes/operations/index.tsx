import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Explorer } from "@/components/explorer/Explorer";
import { useOperationRows } from "@/components/explorer/registers";
import { copy } from "@/copy";

export const Route = createFileRoute("/operations/")({ component: Page });

/** The register as a file explorer (components/explorer/Explorer.tsx). */
function Page() {
  const { rows, loading } = useOperationRows();
  return (
    <div className="flex flex-col gap-4">
      <Explorer
        title={copy.rail.operations}
        icon={Settings2}
        rows={rows}
        loading={loading}
        route="/operations/$id"
        action={<Button asChild><Link to="/new">{copy.operations.newLink}</Link></Button>}
      />
    </div>
  );
}
