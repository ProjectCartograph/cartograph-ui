import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { deriveProjectFramework } from "@/framework/derive";
import { FrameworkTable } from "@/framework/FrameworkTable";
import { useFrameworkNames } from "@/framework/useFrameworkNames";
import { roleOptions, roleRefLabel, useResourceNames } from "@/projects/RoleRefPicker";
import { useProjectStore } from "@/projects/store";

export const Route = createFileRoute("/projects/$id/framework")({ component: Page });

const fc = copy.framework;

/**
 * This project's results framework, read from its own manifest.
 *
 * Read-only on purpose. Every cell is already somewhere in the definition
 * flow, and a matrix that could be edited here would be a second copy of
 * the work that drifts from the first (RESULTS_LOGIC.md R4).
 */
function Page() {
  const { id } = Route.useParams();
  const store = useProjectStore();
  const spec = store.spec;

  const resourceName = useResourceNames();
  const roles = useMemo(
    () => roleOptions(spec.resources ?? [], resourceName),
    [spec.resources, resourceName],
  );
  const names = useFrameworkNames(
    (spec.kpis ?? []).map((k) => k.kpi),
    useMemo(() => (ref) => roleRefLabel(ref, roles), [roles]),
  );

  const rows = useMemo(
    () =>
      deriveProjectFramework(spec, names, {
        when: (w) => copy.projects.success.when[w] ?? w,
        deliverable: (did) => spec.deliverables?.find((d) => d.id === did)?.name ?? did,
      }),
    [spec, names],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fc.title}</h1>
          <p className="text-muted-foreground text-pretty">{fc.subtitle}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/projects/$id" params={{ id }}>
            <ArrowLeft />
            {fc.back}
          </Link>
        </Button>
      </div>
      <FrameworkTable rows={rows} filename={`${id}-results-framework.csv`} empty={fc.empty} />
    </div>
  );
}
