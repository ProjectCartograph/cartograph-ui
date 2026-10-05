// The Goal manifest's spec shape, mirroring contract/schemas/goal.schema.json
// and common.schema.json#/$defs/KeyResult. The generated OpenAPI types don't
// cover this (Manifest.spec is generically "an object"; runtime validation
// always uses the JSON Schema files directly), so this is hand-written and
// kept in step with the schema by hand, the same way the rest of this
// project's kind-specific UI code already does (see the Sheet surface).

export type GoalLevel = "goal" | "objective" | "outcome";

export type KeyResultDirection = "increase" | "decrease" | "reach" | "maintain";
export type KeyResultKind = "percent" | "count" | "money" | "ratio" | "duration";

export interface KeyResultBaselineKnown {
  value: number;
  date: string;
}

export interface KeyResultBaselineUnknown {
  unknownReason: string;
  expectedBy?: string;
}

export type KeyResultBaseline = KeyResultBaselineKnown | KeyResultBaselineUnknown;

export function isKnownBaseline(b: KeyResultBaseline | undefined): b is KeyResultBaselineKnown {
  return !!b && "value" in b;
}

export interface KeyResultTarget {
  value: number;
  date: string;
}

export interface KeyResult {
  id: string;
  metric: string;
  direction: KeyResultDirection;
  kind: KeyResultKind;
  unit?: string;
  baseline?: KeyResultBaseline;
  target?: KeyResultTarget;
  source?: string;
}

export interface GoalSpec {
  level: GoalLevel;
  // A goal has no parent; an objective has a goal as parent; an outcome has an objective as parent.
  parent?: string;
  // Optional: a goal can be named first (metadata.name only) and shaped
  // after. I3.2: the goal is the root of the dependency tree, so it never
  // references team or reviewCycle (both removed from the schema).
  objective?: string;
  whyItMatters?: string;
  // Typed parts only: source (a downward reference) is stripped before a
  // save, never sent to the server (GoalEditor.tsx).
  keyResults?: KeyResult[];
  evidence?: string;
  /** The goal as its source states it, and where. Carried through every
   * save untouched: the editor does not edit them. */
  statedAs?: string;
  source?: string;
  /** Outcomes only: the higher objectives this also leads to, and why
   * (TAXONOMY.md D24). */
  contributesTo?: GoalLink[];
  /** The role accountable for it, and the period it covers (D26). */
  owner?: string;
  horizon?: { start: string; end: string };
}

export interface GoalLink {
  goal: string;
  because?: string;
}

export interface GoalManifest {
  apiVersion: "cartograph/v1";
  kind: "Goal";
  metadata: {
    id: string;
    name: string;
    alias?: string;
    /** References not made yet (TAXONOMY.md D31): an unplaced goal's
     * parent (D35). */
    pending?: { path: string; kind: string; name: string; note?: string }[];
  };
  spec: GoalSpec;
}

/** unit is required when kind is count, money or duration, forbidden otherwise. */
export function kindNeedsUnit(kind: KeyResultKind): boolean {
  return kind === "count" || kind === "money" || kind === "duration";
}
