import { Fragment, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { activeChangeSet } from "@/client/active";
import { useClient } from "@/client/context";
import type { Client } from "@/client/port";
import { useSession } from "@/access/access";
import { copy } from "@/copy";
import { useActiveChangeSet } from "./useActive";

// One change set started at a time, however many editors mount at once.
let starting: Promise<void> | undefined;

/** Picks up the person's newest open change set of their own (not an
 * agent's), or starts one: a new browser does not start a second. */
function ensure(client: Client, me: string): Promise<void> {
  starting ??= client
    .changeSets({ status: "open" })
    .then(async (open) => {
      // Without sign-in a change set names nobody, and is everybody's.
      const mine = open.filter((cs) => !cs.agent && (cs.for ?? "") === (cs.for ? me : "")).sort((a, b) => b.updated.localeCompare(a.updated))[0];
      const id = mine?.id ?? (await client.startChangeSet(copy.workingIn.startTitle)).id;
      if (!activeChangeSet.get()) activeChangeSet.set(id);
    })
    .finally(() => {
      starting = undefined;
    });
  return starting;
}

/**
 * An editor, always working in a change set (engine docs/adr/0024): one
 * that may write and has none active starts one before it opens, so every
 * edit, live or saved, lands in the change set and Merge is the one action
 * that puts it in the workspace. The editor reopens when the change set
 * changes, reading the record as that change set has it.
 */
export function InChangeSet({ children }: { children: ReactNode }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const active = useActiveChangeSet();
  const writes = Boolean(session?.canWrite);
  useEffect(() => {
    if (!writes || active) return;
    void ensure(client, session?.actor ?? "").then(() => queryClient.invalidateQueries());
  }, [writes, active, client, queryClient, session?.actor]);
  if (writes && !active) return <p className="text-sm text-muted-foreground">{copy.projects.record.loading}</p>;
  return <Fragment key={active ?? "none"}>{children}</Fragment>;
}
