import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, GitPullRequest } from "lucide-react";

import { useClient } from "@/client/context";
import type { ChangeSet } from "@/client/port";
import { Badge } from "@/components/ui/badge";
import { DiscardButton } from "./Discard";
import { copy } from "@/copy";

const cc = copy.changeSets;
const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Every piece of work done for this person (engine docs/adr/0022): what
 * waits for them to review first, then what is still being worked on,
 * then what was accepted or closed.
 */
export function ChangeSetsPage() {
  const client = useClient();
  const sets = useQuery({ queryKey: ["changesets"], queryFn: () => client.changeSets(), refetchInterval: 10_000 });
  const all = sets.data ?? [];
  const waiting = all.filter((c) => c.status === "proposed");
  const working = all.filter((c) => c.status === "open" || c.status === "merging");
  const done = all.filter((c) => c.status === "merged" || c.status === "closed");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" data-cartograph-region="change-sets">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <GitPullRequest className="size-6 text-muted-foreground" aria-hidden="true" />
          {cc.title}
        </h1>
        <p className="text-muted-foreground">{cc.intro}</p>
      </div>
      {sets.isSuccess && all.length === 0 ? <p className="text-sm text-muted-foreground">{cc.none}</p> : null}
      {all.length > 0 ? (
        <>
          <Group title={cc.waiting} sets={waiting} empty={cc.noneWaiting} />
          {working.length > 0 ? <Group title={cc.working} sets={working} /> : null}
          {done.length > 0 ? <Group title={cc.done} sets={done} muted /> : null}
        </>
      ) : null}
    </div>
  );
}

function Group({ title, sets, empty, muted }: { title: string; sets: ChangeSet[]; empty?: string; muted?: boolean }) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {sets.length === 0 && empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      <ul className="divide-y rounded-lg border">
        {sets.map((c) => (
          <li key={c.id} className="flex items-center">
            <Link
              to="/changesets/$id"
              params={{ id: c.id }}
              className={`flex min-w-0 flex-1 items-start gap-3 p-3 hover:bg-accent ${muted ? "text-muted-foreground" : ""}`}
              data-cartograph-change-set={c.id}
            >
              <GitPullRequest className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.title}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {c.agent ? (
                    <span className="flex items-center gap-1">
                      <Bot className="size-3" aria-hidden="true" />
                      {cc.by(c.agent)}
                    </span>
                  ) : null}
                  <span>{when.format(new Date(c.updated))}</span>
                </span>
              </span>
              <Badge variant={c.status === "proposed" ? "default" : "outline"} className="shrink-0 font-normal">
                {cc.status[c.status] ?? c.status}
              </Badge>
            </Link>
            {c.status === "open" || c.status === "proposed" ? (
              <span className="pr-2">
                <DiscardButton set={c.id} title={c.title} size="icon" />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
