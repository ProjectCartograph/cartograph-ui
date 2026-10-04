import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, ChevronRight, CircleDashed, GitPullRequest } from "lucide-react";

import { useSession } from "@/access/access";
import { useClient } from "@/client/context";
import { ClientError, type ChangeSetItem, type ChangeSetReview } from "@/client/port";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { kindIcon } from "@/components/vocab";
import { copy } from "@/copy";
import { manifestLink } from "@/proposals/links";
import { fieldLabel, show } from "@/proposals/ProposalReviewPage";

const cc = copy.changeSets;
const kindName = (k: string) => copy.graph.kind[k] ?? k;

/**
 * One change set as its person reviews it (engine docs/adr/0022), like a
 * pull request: what it holds, grouped by kind, each record's changes
 * against the version it started from and its checks with the rest, and
 * anything the record moved on from since. Records not ready are trimmed
 * and stay for later; the rest are accepted whole. While the agent works
 * the page follows it.
 */
export function ChangeSetPage({ id }: { id: string }) {
  const client = useClient();
  const review = useQuery({
    queryKey: ["changesets", id],
    queryFn: () => client.changeSet(id),
    refetchInterval: (q) => (q.state.data && ["open", "proposed", "merging"].includes(q.state.data.changeSet.status) ? 4000 : false),
  });
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6" data-cartograph-region="change-set">
      <Link to="/changesets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {cc.back}
      </Link>
      {review.isError ? <p className="text-sm text-destructive">{cc.failed}</p> : null}
      {review.data ? <Review review={review.data} /> : null}
    </div>
  );
}

function openOf(it: ChangeSetItem) {
  return it.checks.filter((c) => c.state !== "ok").length;
}

function Review({ review }: { review: ChangeSetReview }) {
  const cs = review.changeSet;
  const { data: session } = useSession();
  const mine = !!session && (cs.for ?? "") === (session.email ?? session.actor ?? "").toLowerCase();
  const included = review.items.filter((i) => i.included);
  const byKind = new Map<string, ChangeSetItem[]>();
  for (const it of review.items) byKind.set(it.kind, [...(byKind.get(it.kind) ?? []), it]);
  const editable = cs.status === "open" || cs.status === "proposed";
  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <GitPullRequest className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">{cs.title}</h1>
          <Badge variant={cs.status === "proposed" ? "default" : "outline"} className="font-normal">
            {cc.status[cs.status] ?? cs.status}
          </Badge>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          {cs.agent ? (
            <span className="flex items-center gap-1">
              <Bot className="size-3.5" aria-hidden="true" />
              {cc.by(cs.agent)}
            </span>
          ) : null}
          <span>{cc.items(review.items.length)}</span>
        </p>
        {cs.description ? <p className="max-w-[70ch]">{cs.description}</p> : null}
        {cs.reason ? (
          <p className="max-w-[70ch] text-sm">
            <span className="font-medium">{cc.reason}: </span>
            {cs.reason}
          </p>
        ) : null}
      </header>

      {cs.waivers && cs.waivers.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-4" data-cartograph-region="waivers">
          <h2 className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 text-warning" />
            {cc.waived}
          </h2>
          <ul className="space-y-1 text-sm">
            {cs.waivers.map((w) => (
              <li key={`${w.on}-${w.check}`}>
                {w.on ? <span className="text-muted-foreground">{w.on}: </span> : null}
                <span className="font-medium">{w.message}</span> <span className="text-muted-foreground">{copy.proposals.waivedWhy(w.reason)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label={cc.summary} className="flex flex-wrap gap-2" data-cartograph-region="change-set-summary">
        {[...byKind.entries()].map(([kind, items]) => {
          const Icon = kindIcon(kind);
          const open = items.reduce((n, i) => n + openOf(i), 0);
          return (
            <a key={kind} href={`#kind-${kind}`} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:bg-accent">
              {Icon ? <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
              {kindName(kind)}
              <span className="text-muted-foreground">{items.length}</span>
              {open > 0 ? <span className="size-1.5 rounded-full bg-warning/70" aria-label={cc.openChecks(open)} title={cc.openChecks(open)} /> : null}
            </a>
          );
        })}
      </section>

      {[...byKind.entries()].map(([kind, items]) => (
        <section key={kind} id={`kind-${kind}`} className="flex flex-col gap-2" aria-label={kindName(kind)}>
          <h2 className="text-sm font-medium text-muted-foreground">
            {kindName(kind)} <span className="font-normal">{items.length}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <Item key={`${it.kind}/${it.id}`} set={cs.id} item={it} editable={editable && mine} />
            ))}
          </ul>
        </section>
      ))}

      {mine ? <Decide set={cs.id} status={cs.status} included={included.length} all={review.items.length} /> : null}
    </>
  );
}

function Item({ set, item, editable }: { set: string; item: ChangeSetItem; editable: boolean }) {
  const client = useClient();
  const queries = useQueryClient();
  const [open, setOpen] = useState(false);
  const include = useMutation({
    mutationFn: (on: boolean) => client.includeChangeSetItem(set, item.kind, item.id, on),
    onSuccess: () => queries.invalidateQueries({ queryKey: ["changesets", set] }),
  });
  const openChecks = item.checks.filter((c) => c.state !== "ok");
  const isNew = item.base === 0;
  const link = manifestLink({ kind: item.kind, manifestId: item.id });
  const Icon = kindIcon(item.kind);
  return (
    <li
      className={`rounded-lg border ${item.included ? "" : "border-dashed opacity-70"}`}
      id={`item-${item.kind}-${item.id}`}
      data-cartograph-item={`${item.kind}/${item.id}`}
    >
      <div className="flex items-start gap-3 p-3">
        {editable ? (
          <Checkbox
            className="mt-1"
            checked={item.included}
            onCheckedChange={(on) => include.mutate(on === true)}
            aria-label={`${cc.include}: ${item.name ?? item.id}`}
            title={cc.include}
          />
        ) : null}
        <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronRight className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
          {Icon ? <Icon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{item.name ?? item.id}</span>
            <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {isNew ? <span>{cc.isNew}</span> : <span>{cc.changed(item.changes.length)}</span>}
              {openChecks.length > 0 ? (
                <span className="text-warning">{cc.openChecks(openChecks.length)}</span>
              ) : (
                <span>{cc.allMet}</span>
              )}
              {!item.included ? <span>{cc.trimmed}</span> : null}
            </span>
          </span>
        </button>
      </div>
      {item.stale ? (
        <p className="mx-3 mb-3 flex items-start gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {cc.stale(item.stale)}
        </p>
      ) : null}
      {open ? (
        <div className="space-y-4 border-t p-3 animate-in fade-in duration-150">
          <dl className="divide-y rounded-md border">
            {item.changes.map((c) => (
              <div key={c.path} className="grid gap-1 p-2.5 sm:grid-cols-[12rem_1fr]" data-cartograph-change={c.path}>
                <dt className="text-sm font-medium">{fieldLabel(c.path)}</dt>
                <dd className="space-y-1 text-sm">
                  {c.op !== "add" && c.from !== undefined ? (
                    <pre className="whitespace-pre-wrap rounded bg-destructive/10 px-2 py-1 text-destructive line-through">{show(c.from)}</pre>
                  ) : null}
                  {c.op !== "remove" ? (
                    <pre className="whitespace-pre-wrap rounded bg-success/10 px-2 py-1 text-success">{show(c.to)}</pre>
                  ) : (
                    <span className="text-xs text-muted-foreground">{copy.proposals.removed}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {openChecks.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {openChecks.map((c) => (
                <li key={c.id} className="flex items-start gap-2" data-cartograph-check={c.id}>
                  <CircleDashed className={`mt-0.5 size-4 shrink-0 ${c.state === "block" ? "text-destructive" : "text-warning"}`} />
                  {c.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" />
              {cc.allMet}
            </p>
          )}
          {!isNew ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={link.to as never} params={link.params as never}>
                {cc.openRecord}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Decide({ set, status, included, all }: { set: string; status: string; included: number; all: number }) {
  const client = useClient();
  const queries = useQueryClient();
  const [said, setSaid] = useState<string | undefined>(undefined);
  const refresh = () => queries.invalidateQueries({ queryKey: ["changesets"] });
  const fail = (e: unknown) => setSaid(e instanceof ClientError && e.status === 409 ? cc.staleRefused : cc.failed);
  const accept = useMutation({ mutationFn: () => client.acceptChangeSet(set), onSuccess: () => { setSaid(cc.accepted); void refresh(); }, onError: fail });
  const reopen = useMutation({ mutationFn: () => client.reopenChangeSet(set), onSuccess: () => void refresh(), onError: fail });
  const close = useMutation({ mutationFn: () => client.closeChangeSet(set), onSuccess: () => { setSaid(cc.closed); void refresh(); }, onError: fail });
  const busy = accept.isPending || reopen.isPending || close.isPending;
  if (status !== "open" && status !== "proposed") return said ? <p className="text-sm text-muted-foreground">{said}</p> : null;
  return (
    <section className="sticky bottom-0 flex flex-col gap-2 border-t bg-background/95 py-3 backdrop-blur" data-cartograph-region="change-set-decide">
      {status === "open" ? <p className="text-sm text-muted-foreground">{cc.inProgress}</p> : null}
      {status === "proposed" && included === 0 ? <p className="text-sm text-muted-foreground">{cc.nothingIncluded}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-muted-foreground">{cc.included(included, all)}</span>
        <Button variant="ghost" disabled={busy} onClick={() => close.mutate()}>
          {cc.close}
        </Button>
        {status === "proposed" ? (
          <>
            <Button variant="outline" disabled={busy} onClick={() => reopen.mutate()}>
              {cc.askForChanges}
            </Button>
            <Button disabled={busy || included === 0} onClick={() => accept.mutate()}>
              {cc.accept(included)}
            </Button>
          </>
        ) : null}
      </div>
      {said ? <p className="text-right text-sm text-muted-foreground">{said}</p> : null}
    </section>
  );
}
