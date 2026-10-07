import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, CheckCircle2, CircleDashed } from "lucide-react";

import { useClient } from "@/client/context";
import { ClientError, type ManifestCheck, type ProposalPart, type ProposalReview } from "@/client/port";
import { LeftOpen } from "@/components/LeftOpen";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { ChangeRow, Value, readableChanges, useRecordNames } from "@/changesets/ChangeView";

import { manifestLink } from "./links";
import { proposalTitle } from "./ProposalsPage";

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pc = copy.proposals;

/**
 * One proposal as its person reviews it (engine docs/adr/0016): what it
 * would change against the saved version, its checks, and what the agent
 * left open and why. It is also the manifest's draft, so it opens in the
 * editor, where the person and the agent work on it together. Accepting
 * is here, after reading, and nowhere else.
 */
export function ProposalReviewPage({ id }: { id: string }) {
  const client = useClient();
  const review = useQuery({ queryKey: ["proposals", "review", id], queryFn: () => client.getProposal(id) });
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-cartograph-region="proposal-review">
      <Link to="/proposals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {pc.back}
      </Link>
      {review.isError ? <p className="text-sm text-destructive">{pc.loadFailed}</p> : null}
      {review.data ? <Review review={review.data} /> : null}
    </div>
  );
}

function Review({ review }: { review: ProposalReview }) {
  const p = review.proposal;
  const open = p.status === "open";
  const many = review.parts.length > 1;
  return (
    <>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{many ? pc.setTitle(review.parts.length) : proposalTitle(p)}</h1>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <Bot className="size-4" />
          {pc.by(p.agent, when.format(new Date(p.at)))}
        </p>
        {p.reason ? <p>{p.reason}</p> : null}
        {many ? <p className="text-sm text-muted-foreground">{pc.together}</p> : null}
        {!open && p.decidedBy ? <p className="text-sm text-muted-foreground">{pc.decided(p.status, p.decidedBy)}</p> : null}
      </header>
      {review.parts.map((part) => (
        <Part key={part.proposal.id} part={part} titled={many} />
      ))}
      {open ? <Decide id={p.id} /> : null}
    </>
  );
}

function Part({ part, titled }: { part: ProposalPart; titled: boolean }) {
  const names = useRecordNames();
  const p = part.proposal;
  const link = manifestLink(p);
  const isNew = p.op === "save" && p.base === 0;
  return (
    <section className="space-y-4" data-cartograph-part={`${p.kind}/${p.manifestId}`}>
      {titled ? <h2 className="border-b pb-1 text-lg font-medium">{proposalTitle(p)}</h2> : null}
      {p.waivers && p.waivers.length > 0 ? <LeftOpen left={p.waivers} heading="h3" /> : null}

      {p.op === "save" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-medium">{isNew ? pc.changesNew : pc.changes}</h3>
            <Button variant="outline" size="sm" asChild>
              <Link to={link.to as never} params={link.params as never}>
                {pc.openDraft}
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{pc.openDraftHint}</p>
          {part.changes.length === 0 ? <p className="text-sm text-muted-foreground">{pc.noChanges}</p> : null}
          <dl className="divide-y rounded-lg border">
            {readableChanges(part.changes).map((c) => (
              <ChangeRow key={c.path} change={c} names={names} removedText={pc.removed} />
            ))}
          </dl>
        </div>
      ) : null}

      {p.op === "append" ? (
        <div className="space-y-2">
          <h3 className="font-medium">{pc.item}</h3>
          <div className="rounded bg-muted p-3 text-sm">
            <Value v={p.item} names={names} />
          </div>
        </div>
      ) : null}
      {p.op === "state" ? <p>{pc.moves(p.state ?? "")}</p> : null}

      {part.checks.length > 0 ? <Checks checks={part.checks} /> : null}
    </section>
  );
}

function Checks({ checks }: { checks: ManifestCheck[] }) {
  const open = checks.filter((c) => c.state !== "ok");
  const met = checks.length - open.length;
  return (
    <div className="space-y-2" data-cartograph-region="proposal-checks">
      <h3 className="font-medium">
        {pc.checks} <span className="text-sm font-normal text-muted-foreground">{pc.checksMet(met)}</span>
      </h3>
      <ul className="space-y-1 text-sm">
        {open.map((c) => (
          <li key={c.id} className="flex items-start gap-2" data-cartograph-check={c.id}>
            <CircleDashed className={`mt-0.5 size-4 shrink-0 ${c.state === "block" ? "text-destructive" : "text-warning"}`} />
            {c.message}
          </li>
        ))}
        {met > 0 ? (
          <li className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" />
            {pc.checksMet(met)}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Decide({ id }: { id: string }) {
  const client = useClient();
  const queries = useQueryClient();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const done = () => {
    void queries.invalidateQueries({ queryKey: ["proposals"] });
    void navigate({ to: "/proposals" });
  };
  const fail = (e: unknown) => setProblem(e instanceof ClientError && e.status === 409 ? pc.stale : pc.failed);
  const accept = useMutation({ mutationFn: () => client.acceptProposal(id), onSuccess: done, onError: fail });
  const decline = useMutation({ mutationFn: () => client.declineProposal(id), onSuccess: done, onError: fail });
  const busy = accept.isPending || decline.isPending;
  return (
    <section className="space-y-2 border-t pt-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => decline.mutate()}>
          {pc.decline}
        </Button>
        <Button disabled={busy} onClick={() => accept.mutate()}>
          {pc.accept}
        </Button>
      </div>
      {problem ? <p className="text-right text-sm text-destructive">{problem}</p> : null}
    </section>
  );
}
