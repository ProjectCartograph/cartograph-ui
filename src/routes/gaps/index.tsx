import { createFileRoute, Link } from "@tanstack/react-router";
import { TriangleAlert, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Explorer } from "@/components/explorer/Explorer";
import { useGapRows } from "@/components/explorer/registers";
import { copy, plusNoun } from "@/copy";
import { UnappliedBar } from "@/surfaces/sheet/Unapplied";

export const Route = createFileRoute("/gaps/")({ component: Page });

/** The register as a file explorer (components/explorer/Explorer.tsx). */
function Page() {
  const { rows, loading } = useGapRows();
  return (
    <div className="flex flex-col gap-4">
      <UnappliedBar kind="Gap" />
      <Explorer
        title={copy.rail.gaps}
        icon={TriangleAlert}
        rows={rows}
        loading={loading}
        route="/gaps/$id"
        action={
          <Button asChild aria-label={copy.gaps.newLink}>
            <Link to="/gaps/new">
              <Plus />
              {plusNoun(copy.gaps.newLink)}
            </Link>
          </Button>
        }
      />
    </div>
  );
}
