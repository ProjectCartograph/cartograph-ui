// Every goal-tree mutation (add, rename, move, delete) goes through here:
// a normal versioned PUT (or the dedicated DELETE), actor always "local"
// (I3.2 delta: no actor picker anywhere), reason always the fixed string
// below. No draft mechanism for goals (card I3.2 section 5): every one of
// these lands immediately as a new version. Each takes the Client it
// works through, which a component reads with useClient.

import { ClientError, Conflict, type Client } from "@/client/port";
import type { GoalLevel, GoalManifest, GoalSpec } from "./types";

export const TREE_EDIT_REASON = "edited on the tree";

export interface GoalMutationResult {
  ok: boolean;
  conflict?: boolean;
  problems: { path: string; message: string }[];
}

/** Strips source (a downward reference) from every key result before a
 * Goal is saved: the schema forbids it (I3.2, the goal is the root of the
 * dependency tree), but the shared KeyResult type (also used by Project's
 * own key results) still carries it optionally. */
function goalSafeKeyResults(spec: GoalSpec): GoalSpec["keyResults"] {
  return (spec.keyResults ?? []).map((kr) => ({
    id: kr.id,
    metric: kr.metric,
    direction: kr.direction,
    kind: kr.kind,
    ...(kr.unit ? { unit: kr.unit } : {}),
    ...(kr.baseline ? { baseline: kr.baseline } : {}),
    ...(kr.target ? { target: kr.target } : {}),
  }));
}

/** What a refused write answers: a conflict, or the problems on their
 * fields. A transport failure is not an answer, and still throws. */
function refusal(e: unknown): GoalMutationResult {
  if (e instanceof Conflict) return { ok: false, conflict: true, problems: [] };
  if (e instanceof ClientError) {
    return { ok: false, problems: e.problems.map((p) => ({ path: p.path, message: p.message })) };
  }
  throw e;
}

/** Fetches the current Goal manifest from the server. */
async function getGoalManifest(client: Client, id: string): Promise<GoalManifest | null> {
  let data;
  try {
    data = await client.get("Goal", id);
  } catch (e) {
    if (!(e instanceof ClientError)) throw e;
    console.error(`getGoalManifest: GET returned ${e.status} for Goal/${id}`);
    return null;
  }
  if (!data) {
    console.error(`getGoalManifest: no data in response for Goal/${id}`);
    return null;
  }
  const view = data as unknown as { manifest?: GoalManifest };
  if (!view.manifest) {
    console.error(`getGoalManifest: no manifest field in response for Goal/${id}, got:`, JSON.stringify(view).slice(0, 200));
    return null;
  }
  return view.manifest;
}

async function putGoal(
  client: Client,
  id: string,
  metadataName: string,
  spec: GoalSpec,
  reason: string,
  pending?: GoalManifest["metadata"]["pending"],
  alias?: string,
): Promise<GoalMutationResult> {
  const body: GoalManifest = {
    apiVersion: "cartograph/v1",
    kind: "Goal",
    metadata: { id, name: metadataName, ...(alias ? { alias } : {}), ...(pending?.length ? { pending } : {}) },
    spec: {
      level: spec.level,
      ...(spec.parent ? { parent: spec.parent } : {}),
      ...(spec.objective?.trim() ? { objective: spec.objective.trim() } : {}),
      ...(spec.whyItMatters?.trim() ? { whyItMatters: spec.whyItMatters.trim() } : {}),
      ...(spec.evidence?.trim() ? { evidence: spec.evidence.trim() } : {}),
      // Kept through every save: until 2026-09-30 a save rebuilt the spec
      // from the edited fields only, and dropped the source wording.
      ...(spec.owner ? { owner: spec.owner } : {}),
      ...(spec.horizon?.start && spec.horizon?.end ? { horizon: spec.horizon } : {}),
      ...(spec.statedAs ? { statedAs: spec.statedAs } : {}),
      ...(spec.source ? { source: spec.source } : {}),
      ...((spec.contributesTo ?? []).filter((l) => l.goal).length > 0
        ? { contributesTo: (spec.contributesTo ?? []).filter((l) => l.goal) }
        : {}),
      keyResults: goalSafeKeyResults(spec),
    },
  };
  if (!body.spec.keyResults?.length) delete body.spec.keyResults;
  try {
    await client.saveVersion("Goal", id, body, reason);
    return { ok: true, problems: [] };
  } catch (e) {
    return refusal(e);
  }
}

/** Creates a pillar (no parent) or a strategic goal or functional goal (parentId required):
 * title only, per card section 5's "ask for the title only, inline". */
export function createGoal(
  client: Client,
  id: string,
  name: string,
  level: GoalLevel,
  parentId?: string,
  /** Left unplaced (TAXONOMY.md D35): what it would sit under, as far as
   * the person can say, held by a placeholder until it is placed. */
  unplacedUnder?: string,
): Promise<GoalMutationResult> {
  const unplaced = level !== "goal" && !parentId && unplacedUnder !== undefined;
  return putGoal(
    client,
    id,
    name,
    { level, ...((level === "objective" || level === "outcome") && parentId ? { parent: parentId } : {}) },
    TREE_EDIT_REASON,
    unplaced ? [{ path: "/spec/parent", kind: "Goal", name: unplacedUnder || "Not placed yet" }] : undefined,
  );
}

/** Renames a goal in place: the id (slug) never changes, only
 * metadata.name, keeping every existing spec field untouched.
 * Implements read-modify-write to preserve all goal fields exactly. */
export async function renameGoal(client: Client, id: string, newName: string): Promise<GoalMutationResult> {
  const current = await getGoalManifest(client, id);
  if (!current) {
    return { ok: false, problems: [{ path: "manifest", message: "Goal not found" }] };
  }
  const updated = JSON.parse(JSON.stringify(current)) as GoalManifest;
  updated.metadata.name = newName;
  try {
    await client.saveVersion("Goal", id, updated, TREE_EDIT_REASON);
    return { ok: true, problems: [] };
  } catch (e) {
    return refusal(e);
  }
}

/** Re-parents a goal to a different parent (drag and drop, or the "Move to" control).
 * Implements read-modify-write to preserve all goal fields including key results exactly.
 * Only the parent is changed. */
export async function moveGoal(client: Client, id: string, newParentId: string): Promise<GoalMutationResult> {
  const current = await getGoalManifest(client, id);
  if (!current) return { ok: false, problems: [{ path: "manifest", message: "Goal not found" }] };
  const updated = JSON.parse(JSON.stringify(current)) as GoalManifest;
  updated.spec.parent = newParentId;
  // Placed: the placeholder that held its parent's place ends (D35).
  const kept = (updated.metadata.pending ?? []).filter((p) => p.path !== "/spec/parent");
  if (kept.length) updated.metadata.pending = kept;
  else delete updated.metadata.pending;
  try {
    await client.saveVersion("Goal", id, updated, TREE_EDIT_REASON);
    return { ok: true, problems: [] };
  } catch (e) {
    return refusal(e);
  }
}

/** Saves every field the editor exposes (objective, why it matters,
 * evidence, key results), keeping level and parent untouched. */
export function saveGoalFields(
  client: Client,
  id: string,
  name: string,
  spec: GoalSpec,
  reason: string,
  /** The metadata as read: its alias and placeholders are kept, but for
   * the parent's placeholder once a parent is set (TAXONOMY.md D35). */
  read?: GoalManifest["metadata"],
): Promise<GoalMutationResult> {
  const pending = (read?.pending ?? []).filter((p) => !(spec.parent && p.path === "/spec/parent"));
  return putGoal(client, id, name, spec, reason, pending, read?.alias);
}

export interface DeleteGoalResult {
  ok: boolean;
  /** Present only on refusal: one message per manifest still referencing
   * this goal. */
  problems: string[];
}

/** Deletes a goal (allowed only when nothing references it); refused with
 * the list of what references it otherwise. */
export async function deleteGoal(
  client: Client,
  id: string,
  reason: string = TREE_EDIT_REASON,
): Promise<DeleteGoalResult> {
  try {
    await client.deleteGoal(id, reason);
    return { ok: true, problems: [] };
  } catch (e) {
    if (!(e instanceof ClientError)) throw e;
    return { ok: false, problems: e.problems.map((p) => p.message) };
  }
}
