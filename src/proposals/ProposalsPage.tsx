import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot } from "lucide-react";

import { useClient } from "@/client/context";
import type { Proposal } from "@/client/port";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";

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
      <p className="text-sm text-muted-foreground">{pc.intro} {pc.reviewFirst}</p>
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
  const waived = p.waivers?.length ?? 0;
  return (
    <li className="rounded-lg border p-4" data-cartograph-proposal={p.id}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{proposalTitle(p)}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Bot className="size-3.5" />
            {pc.by(p.agent, when.format(new Date(p.at)))}
          </p>
          {p.reason ? <p className="text-sm">{p.reason}</p> : null}
          {waived > 0 ? (
            <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              {pc.waivers(waived)}
            </p>
          ) : null}
        </div>
        <Button size="sm" asChild>
          <Link to="/proposals/$id" params={{ id: p.id }}>
            {pc.review}
          </Link>
        </Button>
      </div>
    </li>
  );
}
