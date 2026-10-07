import { useQuery } from "@tanstack/react-query";
import { CircleDashed } from "lucide-react";

import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { checkText } from "./MergeBar";
import { useActiveChangeSet } from "./useActive";

/**
 * What stops this record from merging, shown with its own checks: the
 * fields its schema still requires, or a value it refuses, as the change
 * set's review names them. Without this, they showed only in the bar at
 * the foot of the screen.
 */
export function RecordBlocks({ kind, id }: { kind: string; id: string }) {
  const client = useClient();
  const active = useActiveChangeSet();
  const review = useQuery({
    queryKey: ["changeSet", active],
    queryFn: () => client.changeSet(active as string),
    enabled: Boolean(active),
  });
  const item = review.data?.items.find((it) => it.kind === kind && it.id === id);
  const blocks = (item?.checks ?? []).filter((c) => c.id.startsWith("required:"));
  if (blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-destructive/5 p-3 ring-1 ring-destructive/25" data-slot="record-blocks">
      <p className="text-sm font-medium text-destructive">{copy.mergeBar.tierRequired(blocks.length)}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {blocks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <CircleDashed className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            {checkText(c)}
          </li>
        ))}
      </ul>
    </div>
  );
}
