import { useState } from "react";
import { ChevronDown, ChevronUp, LocateFixed, UserCheck } from "lucide-react";

import type { Assumption } from "@/client/port";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { changePlace } from "./ChangeView";

const dc = copy.changeSets.decided;

/** Where a decision was written: the record and the field, for the page
 * to open the record's change and ring the row that holds it. */
export interface DecisionFocus {
  kind: string;
  id: string;
  field?: string;
  /** Changes on every jump, so the same one can be jumped to again. */
  at: number;
}

/** The decision's record, as Kind and id. */
export function decisionRecord(a: Assumption): { kind: string; id: string } {
  const [kind, ...rest] = a.on.split("/");
  return { kind, id: rest.join("/") };
}

/**
 * What the agent decided for its person, with no document and no answer
 * behind it (engine docs/adr/0033): kept apart from the rest of the
 * change set and marked, so the person checks each one before accepting.
 * Each leads to the change it made; previous and next step through them.
 * Best effort: only what the agent declared is here.
 */
export function Decided({ decided, names, onFocus }: { decided: Assumption[]; names: Map<string, string>; onFocus: (f: DecisionFocus) => void }) {
  const [at, setAt] = useState(0);
  if (decided.length === 0) return null;
  const go = (i: number) => {
    const n = (i + decided.length) % decided.length;
    setAt(n);
    const a = decided[n];
    onFocus({ ...decisionRecord(a), field: a.field, at: Date.now() });
  };
  return (
    <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-4" data-cartograph-region="decided" aria-labelledby="decided-heading">
      <div className="flex flex-wrap items-center gap-2">
        <UserCheck className="size-4 text-primary" aria-hidden="true" />
        <h2 id="decided-heading" className="font-medium">
          {dc.heading}
        </h2>
        <span className="text-sm text-muted-foreground">{dc.count(decided.length)}</span>
        {decided.length > 1 ? (
          <span className="ml-auto flex items-center gap-1">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {dc.position(at + 1, decided.length)}
            </span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={dc.previous} title={dc.previous} onClick={() => go(at - 1)}>
              <ChevronUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={dc.next} title={dc.next} onClick={() => go(at + 1)}>
              <ChevronDown />
            </Button>
          </span>
        ) : null}
      </div>
      <p className="max-w-[70ch] text-sm text-muted-foreground">{dc.intro}</p>
      <ol className="space-y-2 text-sm">
        {decided.map((a, i) => {
          const r = decisionRecord(a);
          const where = `${names.get(a.on) ?? r.id}${a.field ? `: ${changePlace(a.field)}` : ""}`;
          return (
            <li
              key={`${a.on}-${a.field ?? ""}`}
              className={`flex items-start gap-3 rounded-md p-2 ${i === at ? "bg-primary/10" : ""}`}
              data-cartograph-decision={`${a.on}${a.field ?? ""}`}
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs text-muted-foreground">{where}</p>
                <p className="font-medium">{a.took}</p>
                {a.why ? (
                  <p className="text-muted-foreground">
                    <span className="font-medium">{dc.why}: </span>
                    {a.why}
                  </p>
                ) : null}
              </div>
              <Button type="button" variant="outline" size="sm" aria-label={dc.goToLabel(a.took)} title={dc.goToLabel(a.took)} onClick={() => go(i)}>
                <LocateFixed />
                {dc.goTo}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
