import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";

import { useClient } from "@/client/context";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { IdeaAnswers, useFromIdea } from "./useFromIdea";

/**
 * Reads a rough idea for the questions kind's walk asks, once per idea,
 * for every step inside to start from (engine POST /from-idea, ADR 0023).
 */
export function FromIdeaProvider({ kind, idea, children }: { kind: string; idea?: string; children: ReactNode }) {
  const client = useClient();
  const text = (idea ?? "").trim();
  const q = useQuery({
    queryKey: ["from-idea", kind, text],
    queryFn: () => client.fromIdea(kind, text),
    enabled: text.split(/\s+/).length >= 4,
    staleTime: Infinity,
    retry: false,
  });
  return <IdeaAnswers.Provider value={q.data?.answers ?? []}>{children}</IdeaAnswers.Provider>;
}

/**
 * The sentence of the person's own idea that answers the question beside
 * it, to use or ignore. Shown only when there is one the model was sure
 * of; never placed in the field for them.
 */
export function FromIdea({ field, onUse }: { field: string; onUse?: (sentence: string) => void }) {
  const answer = useFromIdea(field);
  if (!answer) return null;
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm animate-in fade-in duration-200" data-slot="from-idea" data-field={field}>
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="text-muted-foreground">{copy.common.fromIdea}: </span>
        <q className="italic">{answer.sentence}</q>
      </p>
      {onUse ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onUse(answer.sentence)}>
          {copy.common.useIt}
        </Button>
      ) : null}
    </div>
  );
}
