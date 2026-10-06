import { Check, X } from "lucide-react";

import { copy } from "@/copy";
import { fieldGuide, useGuide } from "./guide";

/**
 * What is one of a kind and what is not, said where the kind is listed,
 * before anyone adds one: the engine's good names, and its poor ones each
 * with why it is something else (a role is a resource, not a segment).
 * Read from the kind's guide, so a person and an agent see the same
 * examples (engine contract/guidance).
 */
export function KindExamples({ kind, compact = false }: { kind: string; compact?: boolean }) {
  const { data: guide } = useGuide(kind);
  const name = fieldGuide(guide, "/metadata/name");
  const good = name?.good ?? [];
  const poor = name?.poor ?? [];
  if (good.length === 0 && poor.length === 0) return null;
  const c = copy.kindExamples;
  return (
    <div
      className={`flex flex-col gap-2 text-sm ${compact ? "" : "max-w-[70ch] rounded-lg bg-muted/40 p-3"}`}
      data-slot="kind-examples"
    >
      {good.length > 0 ? (
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <span className="text-muted-foreground">{c.is} </span>
            {good.join(", ")}
          </p>
        </div>
      ) : null}
      {poor.length > 0 ? (
        <div className="flex items-start gap-2">
          <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{c.isNot}</span>
            <ul className="flex flex-col gap-1">
              {poor.map((p) => (
                <li key={p.text}>
                  <span className="font-medium">{p.text}</span>
                  <span className="text-muted-foreground">: {p.why}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
