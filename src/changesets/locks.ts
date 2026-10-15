/** A check of a change set's item, as far as merging reads it. */
type Check = { id: string; message: string };

// What the engine says of a field that must be there for the record to be
// saved at all; anything else it says is shown as it says it.
export const MISSING = "Needed before this can be merged.";
// What it says of a field not filled in yet, which merges and is filled
// in before the work is handed off (engine docs/adr/0035).
export const UNFILLED = "Not filled in yet.";
export const isUnfilled = (k: Check) => k.id.startsWith("required:") && k.message.startsWith(UNFILLED);
/** Whether a check locks the merge: the record cannot be saved as it
 * stands. An engine before docs/adr/0035 also locked on every field its
 * schema requires, which it still says as required. */
export const locksMerge = (k: Check) => k.id.startsWith("malformed:") || (k.id.startsWith("required:") && !isUnfilled(k));
