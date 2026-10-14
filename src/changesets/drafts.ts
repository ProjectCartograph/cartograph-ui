import type { ChangeSet } from "@/client/port";

/** A draft is a change set still being worked on (engine docs/adr/0024):
 * open, or being saved. */
export const isDraft = (c: ChangeSet) => c.status === "open" || c.status === "merging";
