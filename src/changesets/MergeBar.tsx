import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Eye, GitMerge } from "lucide-react";

import { activeChangeSet } from "@/client/active";
import { useClient } from "@/client/context";
import { ClientError, type Client } from "@/client/port";
import { useGuide } from "@/components/guide";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { manifestLink } from "@/proposals/links";
import { mergeChangeSet } from "./merge";
import { useActiveChangeSet } from "./useActive";

const c = copy.mergeBar;

function useReview(set: string | undefined) {
  const client = useClient();
  const queryClient = useQueryClient();
  // Read again shortly after an edit lands, so the counts follow the
  // typing rather than a timer.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = activeChangeSet.onTouch(() => {
      clearTimeout(t);
      // The engine writes a live draft into the change set a moment
      // after it changes.
      t = setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["changeSet", set] }), 1500);
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, [set, queryClient]);
  return useQuery({
    queryKey: ["changeSet", set],
    queryFn: () => client.changeSet(set as string),
    enabled: Boolean(set),
    refetchInterval: 10_000,
  });
}

/**
 * The one action a change set needs, on every screen: edits are saved into
 * it as they are made, and Merge puts them into the workspace.
 */
export function MergeBar() {
  const active = useActiveChangeSet();
  const review = useReview(active);
  const [confirming, setConfirming] = useState(false);
  const [merged, setMerged] = useState(false);

  if (merged && !active) {
    return (
      <div role="status" className="sticky bottom-0 z-10 mt-6 flex items-center gap-2 rounded-lg border bg-background/95 px-4 py-3 text-sm backdrop-blur" data-cartograph-region="merge-bar">
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        {c.merged}
      </div>
    );
  }
  const items = review.data?.items ?? [];
  if (!active || items.length === 0) return null;
  const open = items.reduce((n, it) => n + it.checks.filter((k) => k.state !== "ok" && !isRequired(k)).length, 0);
  const needed = items.reduce((n, it) => n + it.checks.filter(isRequired).length, 0);

  return (
    <>
      <div
        className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur"
        data-cartograph-region="merge-bar"
      >
        <div className="min-w-0 flex-[1_1_12rem] text-sm">
          <p className="truncate font-medium">{c.saved(review.data?.changeSet.title ?? "")}</p>
          <p className="text-xs text-muted-foreground">
            {c.changes(items.length)}
            {needed > 0 ? <span className="text-destructive"> · {c.needed(needed)}</span> : null}
            {open > 0 ? <span className="text-warning"> · {c.open(open)}</span> : null}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/changesets/$id" params={{ id: active }} aria-label={c.reviewLabel} title={c.reviewLabel}>
            <Eye />
            {c.review}
          </Link>
        </Button>
        <Button type="button" size="sm" onClick={() => setConfirming(true)} aria-label={c.mergeLabel} title={c.mergeLabel}>
          <GitMerge />
          {c.merge}
        </Button>
      </div>
      <MergeDialog
        set={active}
        open={confirming}
        onOpenChange={setConfirming}
        onMerged={() => {
          setMerged(true);
          setTimeout(() => setMerged(false), 5000);
        }}
      />
    </>
  );
}

type Review = Awaited<ReturnType<Client["changeSet"]>>;
type Item = Review["items"][number];
type ItemCheck = Item["checks"][number];

const isRequired = (k: ItemCheck) => k.id.startsWith("required:");

/** Where a record's field is filled in: a project's step for its fields,
 * else the record's editor at the check's section. */
function whereTo(item: Item, check: ItemCheck, stepOf: (path: string) => string | undefined) {
  const step = check.path ? stepOf(check.path) : undefined;
  if (item.kind === "Project" && step) return { to: `/projects/$id/initiation/${step}`, params: { id: item.id }, search: {} };
  const link = manifestLink({ kind: item.kind, manifestId: item.id });
  return { ...link, search: item.kind === "Goal" && check.section ? { fix: check.section } : {} };
}

/** One record's open items in the merge dialog: what must be finished
 * first, then what may wait, each a link to where it is done. */
function RecordItems({ item, onGo }: { item: Item; onGo: () => void }) {
  const { data: guide } = useGuide(item.kind);
  // What must be filled first, then what may wait.
  const open = [...item.checks.filter(isRequired), ...item.checks.filter((k) => k.state !== "ok" && !isRequired(k))];
  // The guide's step holding a field: the longest field path the
  // pointer starts with, list positions read as "-".
  const stepOf = (path: string) => {
    const norm = path.replace(/\/\d+(?=\/|$)/g, "/-");
    let best: { key: string; len: number } | undefined;
    for (const st of guide?.steps ?? []) {
      for (const f of st.fields) {
        if ((norm === f.path || norm.startsWith(`${f.path}/`)) && f.path.length > (best?.len ?? -1)) best = { key: st.key, len: f.path.length };
      }
    }
    return best?.key;
  };
  const titleOf = (path: string) => {
    const key = stepOf(path);
    return guide?.steps.find((st) => st.key === key)?.title;
  };
  if (open.length === 0) return null;
  return (
    <li className="flex flex-col gap-1.5" data-cartograph-item={`${item.kind}/${item.id}`}>
      <p className="font-medium">{item.name ?? item.id}</p>
      <ul className="flex flex-col gap-1">
        {open.map((check) => {
          const go = whereTo(item, check, stepOf);
          const required = isRequired(check);
          return (
            <li key={check.id} className="flex items-start gap-2" data-cartograph-check={check.id}>
              <CircleDashed className={`mt-0.5 size-4 shrink-0 ${required ? "text-destructive" : "text-warning"}`} aria-hidden="true" />
              <Link
                to={go.to as never}
                params={go.params as never}
                search={go.search as never}
                className="min-w-0 flex-1 text-muted-foreground hover:text-foreground hover:underline"
                onClick={onGo}
              >
                {required && check.path ? c.required(fieldName(check.path)) : check.message}
                {required && check.path && titleOf(check.path) ? <span className="ml-1.5 text-xs text-muted-foreground/80">{titleOf(check.path)}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** A field's own name, from the last part of its pointer. */
function fieldName(path: string): string {
  const key = path.split("/").filter((p) => p && !/^\d+$/.test(p)).pop() ?? "";
  return c.fields[key] ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

/**
 * Before a change set merges, what is still open on each record, each a
 * link to where it is finished. What a record must have to be saved is
 * finished first, and Merge waits for it; what may wait is left open with
 * the person's reason, asked once (engine docs/adr/0022).
 */
export function MergeDialog({ set, open: shown, onOpenChange, onMerged }: { set: string; open: boolean; onOpenChange: (open: boolean) => void; onMerged?: () => void }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const review = useReview(set);
  const [why, setWhy] = useState("");
  const [failed, setFailed] = useState<string | undefined>();
  const items = review.data?.items.filter((it) => it.included) ?? [];
  const open = items.flatMap((it) => it.checks.filter((k) => k.state !== "ok").map((k) => ({ item: it, check: k })));
  const required = open.filter((o) => isRequired(o.check));
  const may = open.filter((o) => !isRequired(o.check));
  // A proposed change set already carries a reason for each open item.
  const asks = required.length === 0 && may.length > 0 && (review.data?.changeSet.status ?? "open") === "open";
  const merge = useMutation({
    mutationFn: () =>
      mergeChangeSet(
        client,
        set,
        review.data?.changeSet.status ?? "open",
        may.map(({ item, check }) => ({ kind: item.kind, id: item.id, check: check.id })),
        why.trim(),
      ),
    onSuccess: () => {
      onOpenChange(false);
      setWhy("");
      setFailed(undefined);
      if (activeChangeSet.get() === set) activeChangeSet.set(undefined);
      onMerged?.();
      void queryClient.invalidateQueries();
    },
    onError: (e) => {
      if (e instanceof ClientError && e.status === 409) setFailed(c.stale);
      else if (e instanceof ClientError && e.problems?.length) setFailed(e.problems.map((p) => p.message).join(" "));
      else setFailed(c.failed);
      void queryClient.invalidateQueries({ queryKey: ["changeSet", set] });
    },
  });

  return (
    <Dialog open={shown} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{c.confirmTitle(items.length)}</DialogTitle>
          <DialogDescription>{required.length > 0 ? c.finishFirst : may.length > 0 ? c.confirmOpen : c.confirmReady}</DialogDescription>
        </DialogHeader>
        {open.length > 0 ? (
          <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto text-sm">
            {items.map((it) => (
              <RecordItems key={`${it.kind}/${it.id}`} item={it} onGo={() => onOpenChange(false)} />
            ))}
          </ul>
        ) : null}
        {asks ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="merge-why">{c.whyLabel}</Label>
            <Textarea id="merge-why" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} />
          </div>
        ) : null}
        {failed ? <p className="text-sm text-destructive">{failed}</p> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {c.cancel}
          </Button>
          <Button
            type="button"
            disabled={merge.isPending || items.length === 0 || required.length > 0 || (asks && why.trim() === "")}
            onClick={() => merge.mutate()}
            aria-label={c.mergeLabel}
          >
            <GitMerge />
            {may.length > 0 && required.length === 0 ? c.mergeAnyway : c.merge}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
