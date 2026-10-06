import { AlertTriangle } from "lucide-react";

import { copy } from "@/copy";
import { byReason, type LeftCheck } from "./waivers";

/**
 * What an agent left open for its person, once per missing fact: the
 * reason first, as what to supply, then the checks it holds open, each on
 * its record. Read in a change set and on one proposal alike.
 */
export function LeftOpen({ left, heading: Heading = "h2" }: { left: LeftCheck[]; heading?: "h2" | "h3" }) {
  const facts = byReason(left);
  const c = copy.leftOpen;
  return (
    <section className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4" data-cartograph-region="waivers">
      <Heading className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4 text-warning" />
        {c.heading}
        <span className="text-sm font-normal text-muted-foreground">{c.count(facts.length, left.length)}</span>
      </Heading>
      <ol className="space-y-3 text-sm">
        {facts.map((f) => (
          <li key={f.reason} className="space-y-1">
            <p className="font-medium">{f.reason}</p>
            <ul className="space-y-0.5 text-muted-foreground">
              {f.checks.map((w) => (
                <li key={`${w.on ?? ""}-${w.check}`}>
                  {w.on ? <span>{w.on}: </span> : null}
                  {w.message}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
