import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Explorer } from "@/components/explorer/Explorer";
import { useProjectRows } from "@/components/explorer/registers";
import { copy } from "@/copy";

export const Route = createFileRoute("/projects/")({ component: Page });

/** The register as a file explorer (components/explorer/Explorer.tsx). */
function Page() {
  const { rows, loading } = useProjectRows();
  return (
    <div className="flex flex-col gap-4">
      <Explorer
        title={copy.rail.projects}
        icon={FolderKanban}
        rows={rows}
        loading={loading}
        route="/projects/$id"
        action={<Button asChild><Link to="/new">{copy.projects.list.newProject}</Link></Button>}
      />
    </div>
  );
}
