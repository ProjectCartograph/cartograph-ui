import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy";

export interface AdvisoryCheck {
  id: string;
  section: string;
  state: string;
  message: string;
}

/**
 * The advisory panel for a kind whose checks never block.
 *
 * The project's own panel counts three states, links a fix to a phase and
 * a section, and carries a handoff. None of that applies here: a
 * programme has no phases, and every check on it reads a manifest other
 * than itself — so none of them may refuse a save, and there is no
 * blocking count to show. Two states, and the reader is already on the
 * section the check is about, so there is nothing to link to either.
 *
 * Passing lines are collapsed by default: what is already true is worth
 * one number, and the open list is for what is not.
 */
export function DefinitionCheckPanel({
  items,
  loading,
  section,
}: {
  items: AdvisoryCheck[];
  loading: boolean;
  /** Show only the checks about the section on screen. */
  section: string;
}) {
  const [showPassed, setShowPassed] = useState(false);
  const c = copy.definition.checks;

  const scoped = items.filter((item) => item.section === section);
  const warned = scoped.filter((item) => item.state === "warn");
  const passed = scoped.filter((item) => item.state === "ok");

  if (loading) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-4" data-cartograph-region="checks">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }
  // A section with nothing to say about it gets no panel at all, rather
  // than a panel saying nothing.
  if (scoped.length === 0) return null;

  function Line({ item }: { item: AdvisoryCheck }) {
    return (
      <li className="flex items-start gap-2 text-sm">
        {item.state === "ok" ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1">{item.message}</span>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4" data-cartograph-region="checks">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{c.title}</h2>
        <div className="flex items-center gap-1">
          {warned.length > 0 ? (
            <Badge variant="secondary" className="gap-1" title={c.countWarn(warned.length)}>
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              <span className="truncate">{warned.length}</span>
            </Badge>
          ) : null}
          {passed.length > 0 ? (
            <Badge variant="outline" className="gap-1" title={c.countDone(passed.length)}>
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              <span className="truncate">{passed.length}</span>
            </Badge>
          ) : null}
        </div>
      </div>
      {warned.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.allDone}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {warned.map((item) => (
            <Line key={item.id} item={item} />
          ))}
        </ul>
      )}
      {passed.length > 0 && warned.length > 0 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto self-start p-0 text-xs text-muted-foreground"
            onClick={() => setShowPassed((v) => !v)}
          >
            {showPassed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {c.showPassed(passed.length)}
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
    </div>
  );
}
