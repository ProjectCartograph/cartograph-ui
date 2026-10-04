import { Link } from "@tanstack/react-router";
import { ArrowRight, Hourglass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { useDefinitionStore } from "@/definition/store";
import { useReferencing } from "@/operations/api";
import { statusOf } from "@/operations/status";
import type { OperationSpec } from "@/operations/types";
import { forgetWaiting, waitingProject } from "@/operations/waiting";

const sc = copy.operations.setUpNext;

/**
 * The end of a planned service's walk (TAXONOMY.md D30). The service is
 * defined in full first and saved, since the project that sets it up
 * names it and can only name a saved service; then the walk asks, as its
 * last question, whether to start that project now or later. Later
 * leaves the service's own check asking for it. Defined from a project's
 * placeholder, it leads back to that project instead, to be named there
 * (TAXONOMY.md D31). A running or retired service, or one a project
 * already sets up, ends as any walk does.
 */
export function SetUpNext() {
  const store = useDefinitionStore<OperationSpec>();
  const setUpBy = useReferencing("Operation", store.id, "Project");
  if (statusOf(store.spec) !== "planned" || !setUpBy.data || setUpBy.data.length > 0) return null;
  const waiting = waitingProject(store.id);
  return (
    <section
      aria-label={sc.title}
      className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-sm ring-2 ring-primary"
      data-cartograph-region="set-up-next"
    >
      <p className="flex items-center gap-2 text-base font-semibold">
        <Hourglass className="size-5" aria-hidden="true" />
        {sc.title}
      </p>
      {store.staged ? (
        <p className="text-sm text-muted-foreground" data-slot="save-first">
          {sc.saveFirst}
        </p>
      ) : waiting ? (
        <>
          <p className="text-sm text-muted-foreground">{sc.backQuestion}</p>
          <div>
            <Button asChild>
              <Link to="/projects/$id/landing" params={{ id: waiting }} search={{ resolve: store.id }} onClick={() => forgetWaiting(store.id)}>
                {sc.back}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{sc.question}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link to="/projects/new" search={{ operation: store.id }}>
                {sc.now}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/operations">{sc.later}</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{sc.laterNote}</p>
        </>
      )}
    </section>
  );
}
