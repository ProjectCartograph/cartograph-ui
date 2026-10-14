import { useQueries } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, FolderKanban, Gauge, Layers, Settings2, Target, TriangleAlert, type LucideIcon } from "lucide-react";

import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { manifestLink } from "@/proposals/links";
import { noteVisit, recentVisits, recordOf, type Visit } from "./recent";

const rc = copy.home.recent;
const ICON: Record<string, LucideIcon> = { Project: FolderKanban, Programme: Layers, Portfolio: BriefcaseBusiness, Operation: Settings2, Goal: Target, KPI: Gauge, Gap: TriangleAlert };

/** Notes each record page opened, for Home (#58). Renders nothing. */
export function RecentVisits() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    const r = recordOf(path);
    if (r) noteVisit(r.kind, r.id);
  }, [path]);
  return null;
}

function ago(at: number): string {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return rc.justNow;
  if (m < 60) return rc.minutes(m);
  const h = Math.round(m / 60);
  if (h < 24) return rc.hours(h);
  return rc.days(Math.round(h / 24));
}

/**
 * The records this person opened last, each one click away (#58): Home
 * answers "what was I working on" without a search.
 */
export function Recent() {
  const client = useClient();
  const [visits] = useState<Visit[]>(() => recentVisits().slice(0, 8));
  const views = useQueries({
    queries: visits.map((v) => ({ queryKey: ["recent-name", v.kind, v.id], queryFn: () => client.get(v.kind, v.id), staleTime: 60_000, retry: false })),
  });
  const rows = visits
    .map((v, i) => ({ v, name: (views[i]?.data?.manifest as { metadata?: { name?: string } } | undefined)?.metadata?.name, gone: views[i]?.isError }))
    .filter((r) => !r.gone);
  if (rows.length === 0) return null;
  return (
    <section className="flex w-full flex-col gap-2" data-cartograph-region="home-recent" aria-labelledby="home-recent-title">
      <h2 id="home-recent-title" className="text-sm font-medium text-muted-foreground">
        {rc.title}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map(({ v, name }) => {
          const Icon = ICON[v.kind] ?? FolderKanban;
          const link = manifestLink({ kind: v.kind, manifestId: v.id } as never);
          return (
            <li key={`${v.kind}/${v.id}`}>
              <Link
                to={link.to as never}
                params={link.params as never}
                className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors duration-150 ease-standard hover:bg-muted/60"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{name ?? v.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {copy.sheets.kindsSingular[v.kind] ?? v.kind} · {ago(v.at)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
