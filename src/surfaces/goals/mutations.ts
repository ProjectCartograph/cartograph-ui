// Every goal-tree mutation (add, rename, move, delete) goes through here:
// a normal versioned PUT (or the dedicated DELETE), actor always "local"
// (I3.2 delta: no actor picker anywhere), reason always the fixed string
// below. No draft mechanism for goals (card I3.2 section 5): every one of
// these lands immediately as a new version.

import { client } from "@/api/client";
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

/** Fetches the current Goal manifest from the server. */
async function getGoalManifest(id: string): Promise<GoalManifest | null> {
  // openapi-fetch has already read the body into `data`; reading
  // `response.json()` again throws "body used", which is how every inline
  // rename silently failed before (ISSUES_LOG #27 follow-up).
  const { data, response } = await client.GET("/manifests/{kind}/{id}", {
    params: { path: { kind: "Goal", id } },
  });
  if (response.status !== 200) {
    console.error(`getGoalManifest: GET returned ${response.status} for Goal/${id}`);
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

async function putGoal(id: string, metadataName: string, spec: GoalSpec, reason: string): Promise<GoalMutationResult> {
  const body: GoalManifest = {
    apiVersion: "cartograph/v1",
    kind: "Goal",
    metadata: { id, name: metadataName },
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
  const { error, response } = await client.PUT("/manifests/{kind}/{id}", {
    params: { path: { kind: "Goal", id } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { manifest: body as any, reason },
  });
  if (!error) return { ok: true, problems: [] };
  if (response.status === 409) return { ok: false, conflict: true, problems: [] };
  return { ok: false, problems: ((error as any).problems ?? []).map((p: any) => ({ path: p.path, message: p.message })) };
}

/** Creates a pillar (no parent) or a strategic goal or functional goal (parentId required):
 * title only, per card section 5's "ask for the title only, inline". */
export function createGoal(id: string, name: string, level: GoalLevel, parentId?: string): Promise<GoalMutationResult> {
  return putGoal(id, name, { level, ...((level === "objective" || level === "outcome") && parentId ? { parent: parentId } : {}) }, TREE_EDIT_REASON);
}

/** Renames a goal in place: the id (slug) never changes, only
 * metadata.name, keeping every existing spec field untouched.
 * Implements read-modify-write to preserve all goal fields exactly. */
export async function renameGoal(id: string, newName: string): Promise<GoalMutationResult> {
  const current = await getGoalManifest(id);
  if (!current) {
    return { ok: false, problems: [{ path: "manifest", message: "Goal not found" }] };
  }
  const updated = JSON.parse(JSON.stringify(current)) as GoalManifest;
  updated.metadata.name = newName;
  const { error, response } = await client.PUT("/manifests/{kind}/{id}", {
    params: { path: { kind: "Goal", id } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { manifest: updated as any, reason: TREE_EDIT_REASON },
  });
  if (!error) return { ok: true, problems: [] };
  if (response.status === 409) return { ok: false, conflict: true, problems: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ok: false, problems: ((error as any).problems ?? []).map((p: any) => ({ path: p.path, message: p.message })) };
}

/** Re-parents a goal to a different parent (drag and drop, or the "Move to" control).
 * Implements read-modify-write to preserve all goal fields including key results exactly.
 * Only the parent is changed. */
export async function moveGoal(id: string, newParentId: string): Promise<GoalMutationResult> {
  const current = await getGoalManifest(id);
  if (!current) return { ok: false, problems: [{ path: "manifest", message: "Goal not found" }] };
  const updated = JSON.parse(JSON.stringify(current)) as GoalManifest;
  updated.spec.parent = newParentId;
  const { error, response } = await client.PUT("/manifests/{kind}/{id}", {
    params: { path: { kind: "Goal", id } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { manifest: updated as any, reason: TREE_EDIT_REASON },
  });
  if (!error) return { ok: true, problems: [] };
  if (response.status === 409) return { ok: false, conflict: true, problems: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ok: false, problems: ((error as any).problems ?? []).map((p: any) => ({ path: p.path, message: p.message })) };
}

/** Saves every field the editor exposes (objective, why it matters,
 * evidence, key results), keeping level and parent untouched. */
export function saveGoalFields(id: string, name: string, spec: GoalSpec, reason: string): Promise<GoalMutationResult> {
  return putGoal(id, name, spec, reason);
}

export interface DeleteGoalResult {
  ok: boolean;
  /** Present only on refusal: one message per manifest still referencing
   * this goal. */
  problems: string[];
}

/** Deletes a goal (allowed only when nothing references it); refused with
 * the list of what references it otherwise. */
export async function deleteGoal(id: string, reason: string = TREE_EDIT_REASON): Promise<DeleteGoalResult> {
  const { error } = await client.DELETE("/manifests/Goal/{id}", {
    params: { path: { id } },
    body: { reason },
  });
  if (!error) return { ok: true, problems: [] };
  return { ok: false, problems: (error.problems ?? []).map((p) => p.message) };
}
