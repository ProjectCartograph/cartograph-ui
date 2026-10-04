import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, Type } from "lucide-react";

import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { manifestLink } from "@/proposals/links";

const hc = copy.home;

/**
 * What already says what a person is about to define, shown as they type
 * its name, so a record that exists is opened rather than written twice
 * (engine docs/adr/0023). It never stands in the way: the list is advice,
 * and nothing is shown while nothing matches.
 */
export function AlreadyThere({ kind, text, level }: { kind: string; text: string; level?: string }) {
  const client = useClient();
  const [settled, setSettled] = useState("");
  // Asked once the typing pauses, not at every key.
  useEffect(() => {
    const t = setTimeout(() => setSettled(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);
  const matches = useQuery({
    queryKey: ["match", kind, level ?? "", settled],
    queryFn: () => client.match(kind, settled, level),
    enabled: settled.length >= 3,
    retry: false,
  });
  const found = matches.data ?? [];
  if (found.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 p-3 animate-in fade-in duration-150 ease-standard" data-slot="already-there">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{hc.already}</p>
      <ul className="flex flex-col gap-0.5">
        {found.map((m) => {
          const link = manifestLink({ kind: m.kind, manifestId: m.id });
          const Mark = m.by === "model" ? Sparkles : Type;
          return (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <Mark className="size-3.5 shrink-0 text-muted-foreground" aria-label={m.by === "model" ? hc.byMeaning : hc.byWords} />
              {link ? (
                <Link to={link.to as never} params={link.params as never} className="truncate font-medium underline-offset-4 hover:underline">
                  {m.name}
                </Link>
              ) : (
                <span className="truncate font-medium">{m.name}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
