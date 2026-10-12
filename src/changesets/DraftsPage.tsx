import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, FilePen, PenLine } from "lucide-react";

import { activeChangeSet } from "@/client/active";
import { useClient } from "@/client/context";
import type { ChangeSet } from "@/client/port";
import { administers, useSession } from "@/access/access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { DiscardButton } from "./Discard";
import { isDraft } from "./drafts";
import { useActiveChangeSet } from "./useActive";

const dc = copy.drafts;
const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Work not yet merged: every edit lands in a draft, so a project started
 * and left is found here, with the one this window works in marked and a
 * way to carry on in any other. An administrator also sees everyone
 * else's drafts, under whose they are; for anyone else the engine keeps
 * another person's drafts to them.
 */
export function DraftsPage() {
  const client = useClient();
  const { data: session } = useSession();
  const admin = administers(session);
  const mine = useQuery({ queryKey: ["changesets"], queryFn: () => client.changeSets(), refetchInterval: 10_000 });
  const everyone = useQuery({
    queryKey: ["changesets", "everyone"],
    queryFn: () => client.changeSets({ everyone: true }),
    enabled: admin && !!session?.access,
    refetchInterval: 15_000,
  });
  const own = (mine.data ?? []).filter(isDraft);
  const ownIds = new Set(own.map((c) => c.id));
  const others = (everyone.data ?? []).filter((c) => isDraft(c) && !ownIds.has(c.id));
  const byPerson = new Map<string, ChangeSet[]>();
  for (const c of others) {
    const who = c.for ?? dc.someone;
    byPerson.set(who, [...(byPerson.get(who) ?? []), c]);
  }
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-cartograph-region="drafts">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FilePen className="size-6 text-muted-foreground" aria-hidden="true" />
          {dc.title}
        </h1>
        <p className="text-muted-foreground">{dc.intro}</p>
      </div>
      <section className="flex flex-col gap-2" aria-label={dc.yours}>
        <h2 className="text-sm font-medium text-muted-foreground">{dc.yours}</h2>
        {mine.isSuccess && own.length === 0 ? <p className="text-sm text-muted-foreground">{dc.none}</p> : null}
        {own.length > 0 ? <Drafts sets={own} canWorkIn /> : null}
      </section>
      {[...byPerson.entries()].map(([who, sets]) => (
        <section key={who} className="flex flex-col gap-2" aria-label={dc.theirs(who)} data-cartograph-region="drafts-others">
          <h2 className="text-sm font-medium text-muted-foreground">{dc.theirs(who)}</h2>
          <Drafts sets={sets} />
        </section>
      ))}
    </div>
  );
}

function Drafts({ sets, canWorkIn = false }: { sets: ChangeSet[]; canWorkIn?: boolean }) {
  const active = useActiveChangeSet();
  const queryClient = useQueryClient();
  return (
    <ul className="divide-y rounded-lg border">
      {sets.map((c) => (
        <li key={c.id} className="flex items-center gap-1" data-cartograph-change-set={c.id}>
          <Link to="/changesets/$id" params={{ id: c.id }} className="flex min-w-0 flex-1 items-start gap-3 p-3 hover:bg-accent">
            <FilePen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.title}</span>
              <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {c.agent ? (
                  <span className="flex items-center gap-1">
                    <Bot className="size-3" aria-hidden="true" />
                    {copy.changeSets.by(c.agent)}
                  </span>
                ) : null}
                <span>{dc.edited(when.format(new Date(c.updated)))}</span>
                {/* Under the title, not beside it: on a phone the title
                    needs the width. */}
                {c.id === active ? (
                  <Badge variant="secondary" className="font-normal">
                    {dc.here}
                  </Badge>
                ) : null}
              </span>
            </span>
          </Link>
          {canWorkIn && c.id !== active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                activeChangeSet.set(c.id);
                void queryClient.invalidateQueries();
              }}
              aria-label={dc.workInTitle(c.title)}
              title={dc.workInTitle(c.title)}
            >
              <PenLine />
              {dc.workIn}
            </Button>
          ) : null}
          {canWorkIn ? (
            <span className="pr-2">
              <DiscardButton set={c.id} title={c.title} size="icon" />
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
