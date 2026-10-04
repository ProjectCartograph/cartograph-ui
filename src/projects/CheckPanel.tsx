import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, OctagonAlert } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy";
import { useProjectChecks } from "./api";
import { ALL_SECTIONS } from "./types";

const cc = copy.projects.checks;

function iconFor(state: string) {
  if (state === "ok") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success/70" />;
  if (state === "block") return <OctagonAlert className="mt-0.5 size-4 shrink-0 text-destructive" />;
  return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />;
}

/**
 * The right-rail checks panel (rule 4: "the right rail shows ... its own
 * checks"). Optionally scoped to one section (a phase page shows only the
 * checks about it) or to a phase (Closing, Landing). Every fix link
 * navigates straight to the section that owns the problem.
 */
export function CheckPanel({
  id,
  draft,
  scopeSection,
  scopePhase,
}: {
  id: string;
  draft: boolean;
  scopeSection?: string;
  scopePhase?: string;
}) {
  const checksQuery = useProjectChecks(id, draft);
  const navigate = useNavigate();

  const items = (checksQuery.data?.items ?? []).filter((item) => {
    if (scopeSection && item.section !== scopeSection) return false;
    if (scopePhase && item.phase !== scopePhase) return false;
    return true;
  });

  function goToFix(phase: string, section: string) {
    const entry = ALL_SECTIONS.find((s) => s.phase === phase && s.section === section);
    if (entry) {
      // ALL_SECTIONS.path is assembled generically from a fixed, known set
      // of registered routes; the router's own literal-union route typing
      // cannot express that statically, so this one navigation call is cast.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void navigate({ to: `/projects/$id${entry.path}`, params: { id } } as any);
    } else if (phase === "closing" || phase === "landing") {
      void navigate({ to: `/projects/$id/${phase}`, params: { id } });
    }
  }

  const blocked = items.filter((i) => i.state === "block");
  const warned = items.filter((i) => i.state === "warn");
  const passed = items.filter((i) => i.state === "ok");
  const [showPassed, setShowPassed] = useState(false);

  function Line({ item }: { item: (typeof items)[number] }) {
    return (
      <li className="flex items-start gap-2 text-sm">
        {iconFor(item.state)}
        <span className="flex-1">
          {item.message}
          {item.state !== "ok" && item.fix ? (
            <Button
              type="button"
              variant="link"
              className="ml-1 h-auto p-0 text-sm"
              onClick={() => goToFix(item.fix!.phase, item.fix!.section)}
            >
              {cc.fix}
            </Button>
          ) : null}
        </span>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-inset ring-border" data-cartograph-region="checks">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{cc.title}</h2>
        {/* The state of the section as three marks and three numbers,
            instead of a paragraph per check. */}
        <div className="flex items-center gap-1">
          {blocked.length > 0 ? (
            <Badge variant="destructive" className="gap-1" title={cc.countBlocked(blocked.length)}>
              <OctagonAlert className="size-3.5" aria-hidden="true" />
              {blocked.length}
            </Badge>
          ) : null}
          {warned.length > 0 ? (
            <Badge variant="secondary" className="gap-1" title={cc.countWarn(warned.length)}>
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {warned.length}
            </Badge>
          ) : null}
          {passed.length > 0 ? (
            <Badge variant="outline" className="gap-1" title={cc.countDone(passed.length)}>
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {passed.length}
            </Badge>
          ) : null}
        </div>
      </div>
      {checksQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{cc.none}</p>
      ) : (
        <>
          {blocked.length + warned.length === 0 ? (
            <p className="text-sm text-muted-foreground">{cc.allDone}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {blocked.map((item) => (
                <Line key={item.id} item={item} />
              ))}
              {warned.map((item) => (
                <Line key={item.id} item={item} />
              ))}
            </ul>
          )}
          {passed.length > 0 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto self-start p-0 text-xs text-muted-foreground"
                aria-expanded={showPassed}
                onClick={() => setShowPassed((v) => !v)}
              >
                {showPassed ? <ChevronUp /> : <ChevronDown />}
                {showPassed ? cc.hideDone : cc.showDone}
              </Button>
              {showPassed ? (
                <ul className="flex flex-col gap-2">
                  {passed.map((item) => (
                    <Line key={item.id} item={item} />
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
