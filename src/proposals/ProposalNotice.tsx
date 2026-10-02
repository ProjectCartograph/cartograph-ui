import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";

import { useClient } from "@/client/context";
import { copy } from "@/copy";

/**
 * A line on a manifest when an agent has proposed a change to it, for
 * everyone who reads it: what is coming, before anyone accepts it.
 */
export function ProposalNotice({ kind, id }: { kind: string; id: string }) {
  const client = useClient();
  const open = useQuery({
    queryKey: ["proposals", kind, id],
    queryFn: () => client.proposals({ kind, id }),
    enabled: !!id,
  });
  const first = open.data?.[0];
  if (!first) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm dark:border-violet-800 dark:bg-violet-950" data-cartograph-region="proposal-notice">
      <span className="flex items-center gap-2">
        <Bot className="size-4 text-violet-600" />
        {copy.proposals.notice(first.agent)}
      </span>
      <Link to="/proposals" className="font-medium underline-offset-2 hover:underline">
        {copy.proposals.review}
      </Link>
    </div>
  );
}
