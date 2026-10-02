import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";

import { useClient } from "@/client/context";
import { ClientError, type Proposal } from "@/client/port";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";

import { manifestLink } from "./links";

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pc = copy.proposals;

/** What a proposal would do, in a line. */
export function proposalTitle(p: Proposal): string {
  switch (p.op) {
    case "append":
      return pc.append(p.manifestId, String((p.item as { period?: string } | undefined)?.period ?? ""));
    case "state":
      return pc.state(p.manifestId, p.state ?? "");
    default:
      return pc.save(p.kind, p.manifestId);
  }
}

/**
 * The proposals waiting for the signed-in person (engine docs/adr/0016):
 * what their agents proposed, to accept as their own or decline.
 */
export function ProposalsPage() {
  const client = useClient();
  const list = useQuery({ queryKey: ["proposals"], queryFn: () => client.proposals() });
  return (
    <div className="mx-auto max-w-3xl space-y-5" data-cartograph-region="proposals">
      <p className="text-sm text-muted-foreground">{pc.intro}</p>
      {list.isError ? <p className="text-sm text-destructive">{pc.loadFailed}</p> : null}
      {list.data && list.data.length === 0 ? <p className="text-sm text-muted-foreground">{pc.none}</p> : null}
      <ul className="space-y-3">
        {(list.data ?? []).map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </ul>
    </div>
  );
}

function ProposalCard({ proposal: p }: { proposal: Proposal }) {
  const client = useClient();
  const queries = useQueryClient();
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const settle = () => {
    void queries.invalidateQueries({ queryKey: ["proposals"] });
  };
  const fail = (e: unknown) => setProblem(e instanceof ClientError && e.status === 409 ? pc.stale : pc.failed);
  const accept = useMutation({ mutationFn: () => client.acceptProposal(p.id), onSuccess: settle, onError: fail });
  const decline = useMutation({ mutationFn: () => client.declineProposal(p.id), onSuccess: settle, onError: fail });
  const link = manifestLink(p);
  const proposed = p.manifest ?? p.item;
  return (
    <li className="space-y-2 rounded-lg border p-4" data-cartograph-proposal={p.id}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{proposalTitle(p)}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Bot className="size-3.5" />
            {pc.by(p.agent, when.format(new Date(p.at)))}
          </p>
          {p.reason ? <p className="text-sm">{p.reason}</p> : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={link.to as never} params={link.params as never}>
              {pc.open}
            </Link>
          </Button>
          <Button variant="outline" size="sm" disabled={decline.isPending || accept.isPending} onClick={() => decline.mutate()}>
            {pc.decline}
          </Button>
          <Button size="sm" disabled={accept.isPending || decline.isPending} onClick={() => accept.mutate()}>
            {pc.accept}
          </Button>
        </div>
      </div>
      {proposed ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{pc.show}</summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(proposed, null, 2)}</pre>
        </details>
      ) : null}
      {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
    </li>
  );
}
