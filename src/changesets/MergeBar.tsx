import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Eye, GitMerge } from "lucide-react";

import { activeChangeSet } from "@/client/active";
import { useClient } from "@/client/context";
import { ClientError } from "@/client/port";
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
  const open = items.reduce((n, it) => n + it.checks.filter((k) => k.state !== "ok").length, 0);

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

/**
 * Before a change set merges, what is still open on each record, each a
 * link to where it is finished. Merging with items open asks once why, and
 * leaves each open with that reason (engine docs/adr/0022).
 */
export function MergeDialog({ set, open: shown, onOpenChange, onMerged }: { set: string; open: boolean; onOpenChange: (open: boolean) => void; onMerged?: () => void }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const review = useReview(set);
  const [why, setWhy] = useState("");
  const [failed, setFailed] = useState<string | undefined>();
  const items = review.data?.items.filter((it) => it.included) ?? [];
  const open = items.flatMap((it) => it.checks.filter((k) => k.state !== "ok").map((k) => ({ item: it, check: k })));
  // A proposed change set already carries a reason for each open item.
  const asks = open.length > 0 && (review.data?.changeSet.status ?? "open") === "open";
  const merge = useMutation({
    mutationFn: () =>
      mergeChangeSet(
        client,
        set,
        review.data?.changeSet.status ?? "open",
        open.map(({ item, check }) => ({ kind: item.kind, id: item.id, check: check.id })),
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
    onError: (e) => setFailed(e instanceof ClientError && e.status === 409 ? c.stale : c.failed),
  });

  return (
    <Dialog open={shown} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{c.confirmTitle(items.length)}</DialogTitle>
          <DialogDescription>{open.length > 0 ? c.confirmOpen : c.confirmReady}</DialogDescription>
        </DialogHeader>
        {open.length > 0 ? (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
            {open.map(({ item, check }) => {
              const link = manifestLink({ kind: item.kind, manifestId: item.id });
              return (
                <li key={`${item.kind}/${item.id}/${check.id}`} className="flex items-start gap-2" data-cartograph-check={check.id}>
                  <CircleDashed className={`mt-0.5 size-4 shrink-0 ${check.state === "block" ? "text-destructive" : "text-warning"}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <Link
                      to={link.to as never}
                      params={link.params as never}
                      search={(item.kind === "Goal" && check.section ? { fix: check.section } : {}) as never}
                      className="font-medium hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      {item.name ?? item.id}
                    </Link>
                    <span className="block text-muted-foreground">{check.message}</span>
                  </span>
                </li>
              );
            })}
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
            disabled={merge.isPending || items.length === 0 || (asks && why.trim() === "")}
            onClick={() => merge.mutate()}
            aria-label={c.mergeLabel}
          >
            <GitMerge />
            {open.length > 0 ? c.mergeAnyway : c.merge}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
