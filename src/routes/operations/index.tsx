import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Explorer } from "@/components/explorer/Explorer";
import { useOperationRows } from "@/components/explorer/registers";
import { copy, plusNoun } from "@/copy";

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
        action={
          <Button asChild aria-label={copy.operations.newLink}>
            <Link to="/operations/new">
              <Plus />
              {plusNoun(copy.operations.newLink)}
            </Link>
          </Button>
        }
      />
    </div>
  );
}
