import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp } from "lucide-react";

import { useClient } from "@/client/context";
import type { Match } from "@/client/port";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";

const dc = copy.didYouMean;

/** Sure enough to ask: the same name spelt otherwise or by its initials
 * (the engine gives those 1), or the model sure it says the same. */
const SURE = 0.85;

/**
 * Before a record is named that is already there under another spelling
 * ("Depot customers" for Depot Customers) or another form ("SMS" for
 * Student Management System), the one already there is offered: use it,
 * or carry on with the new one. Asked as the typing pauses, of the
 * engine's matcher (the decision model where there is one, engine
 * docs/adr/0023), and only when it is sure; it never stands in the way.
 */
export function DidYouMean({ kind, level, name, onUse }: { kind: string; level?: string; name: string; onUse: (m: Match) => void }) {
  const client = useClient();
  const [settled, setSettled] = useState("");
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setTimeout(() => setSettled(name.trim()), 400);
    return () => clearTimeout(t);
  }, [name]);
  const matches = useQuery({
    queryKey: ["match", kind, level ?? "", settled],
    queryFn: () => client.match(kind, settled, level),
    enabled: settled.length >= 2,
    retry: false,
    staleTime: 30_000,
  });
  const best = (matches.data ?? []).find((m) => m.likelihood >= SURE);
  // Asked once a name: an exact match of what is there is no question.
  if (!best || declined.has(`${settled}\n${best.id}`) || best.name === name.trim()) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm ring-1 ring-primary/20 animate-in fade-in slide-in-from-top-1 duration-200 ease-enter" data-slot="did-you-mean">
      <CircleHelp className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {dc.ask} <span className="font-medium">{best.name}</span>?
      </span>
      <Button type="button" size="sm" variant="outline" onClick={() => onUse(best)}>
        {dc.use}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setDeclined((prev) => new Set(prev).add(`${settled}\n${best.id}`))}>
        {dc.keep}
      </Button>
    </div>
  );
}
