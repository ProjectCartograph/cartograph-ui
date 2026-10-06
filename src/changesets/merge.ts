import type { Client } from "@/client/port";

/** A check still open on one of the change set's records. */
export interface OpenItem {
  kind: string;
  id: string;
  check: string;
}

/**
 * Merges a change set into the workspace in one step: a person's own
 * change set is still open, so it is proposed first, then accepted (the
 * author rolls in, engine docs/adr/0024). What is still open is left open
 * with the person's reason, as proposing requires (docs/adr/0022). One an
 * agent proposed is accepted as it stands.
 */
export async function mergeChangeSet(client: Client, set: string, status: string, open: OpenItem[] = [], why = ""): Promise<void> {
  if (status === "open") {
    const left: Record<string, Record<string, string>> = {};
    for (const o of open) (left[`${o.kind}/${o.id}`] ??= {})[o.check] = why;
    await client.proposeChangeSet(set, undefined, open.length > 0 ? left : undefined);
  }
  await client.acceptChangeSet(set);
}
