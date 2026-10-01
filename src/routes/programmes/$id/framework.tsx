import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { useDefinitionStore } from "@/definition/store";
import { deriveProgrammeFramework } from "@/framework/derive";
import { FrameworkTable } from "@/framework/FrameworkTable";
import { useFrameworkNames } from "@/framework/useFrameworkNames";
import { useProgrammeMembers } from "@/programmes/api";
import type { ProgrammeSpec } from "@/programmes/types";

export const Route = createFileRoute("/programmes/$id/framework")({ component: Page });

const fc = copy.framework;

/**
 * This programme's results framework: its pathway, read as a matrix.
 *
 * The outputs are the work inside it, because a programme delivers
 * nothing itself — and the reasoning on each step is carried through,
 * which is the one column a logframe has nowhere to write.
 */
function Page() {
  const { id } = Route.useParams();
  const store = useDefinitionStore<ProgrammeSpec>();
  const spec = store.spec;
  const members = useProgrammeMembers(id);

  const names = useFrameworkNames(
    spec.kpis ?? [],
    // A programme references no roles inside itself, so a reference here
    // is only ever one Cartograph does not hold.
    useMemo(() => (ref) => ref?.external ?? ref?.id ?? "", []),
  );

  const inside = useMemo(
    () => (members.data ?? []).filter((m) => m.namesThisProgramme).map((m) => ({ name: m.name })),
    [members.data],
  );

  const rows = useMemo(
    () => deriveProgrammeFramework(spec, names, inside),
    [spec, names, inside],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fc.title}</h1>
          <p className="text-muted-foreground text-pretty">{fc.programmeSubtitle}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/programmes/$id/aim" params={{ id }}>
            <ArrowLeft />
            {fc.back}
          </Link>
        </Button>
      </div>
      <FrameworkTable rows={rows} filename={`${id}-results-framework.csv`} empty={fc.empty} />
    </div>
  );
}
