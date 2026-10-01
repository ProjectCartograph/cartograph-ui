import type { PathwayStep } from "./types";

/**
 * The pathway as it is authored, which is backwards and downwards.
 *
 * A theory of change is written by backwards mapping: name the outcome the
 * programme is for, ask what has to be true before it, and repeat until
 * the answer is something the work inside it actually does. Two attempts
 * got this wrong in different ways, and both are worth remembering:
 *
 *   - A flat list in the file's own order made the first card the *last*
 *     link in the chain, with nothing to rest on and nothing yet to bring
 *     about.
 *   - A flat list in reverse fixed the order and left the interaction:
 *     the only way to say what a step rested on was to pick something
 *     from a list that was empty until it had been created somewhere
 *     else, and a step created that way was badged as an outcome until
 *     somebody wired it up (Programme Lead, 2026-09-29).
 *
 * So a precondition is *created from the step that needs it*, and the
 * cards are a tree: the outcome at the top, what it rests on indented
 * under it, and so on down. The file keeps its causal order, earliest
 * first, so reading the YAML still runs from the work up to the outcome.
 */

/** What a step is. The one nothing waits on is where the pathway ends. */
export type StepRole = "outcome" | "precondition";

export interface PathwayCard {
  step: PathwayStep;
  /** Where this step sits in the stored array, which stays causal. */
  at: number;
  role: StepRole;
  /** How far back from an outcome this step is, for the indent. */
  depth: number;
  /** Nothing on this pathway comes before it. */
  startsHere: boolean;
  /** The outcomes it rests on that are drawn elsewhere in the tree,
   * because another step claimed them first. A shared precondition is
   * drawn once and mentioned wherever else it is needed. */
  sharedFrom: string[];
}

/**
 * The steps as a tree, outcome first.
 *
 * `pending` maps a step's id to the id of the step it was created under,
 * for the moment between "add what has to hold before it" and picking the
 * goal that makes the edge real. Without it a half-written precondition
 * would sit at the top of the screen badged as an outcome, which is what
 * it looks like to a graph that has not been told otherwise.
 */
export function pathwayCards(
  steps: PathwayStep[],
  pending: Record<string, string> = {},
): PathwayCard[] {
  const waitedOn = new Set<string>();
  for (const s of steps) for (const id of s.from ?? []) waitedOn.add(id);

  const indexOfOutcome = new Map<string, number>();
  steps.forEach((s, i) => {
    if (s.outcome && !indexOfOutcome.has(s.outcome)) indexOfOutcome.set(s.outcome, i);
  });

  const childrenPending = new Map<string, number[]>();
  steps.forEach((s, i) => {
    const parent = s.id ? pending[s.id] : undefined;
    if (!parent) return;
    childrenPending.set(parent, [...(childrenPending.get(parent) ?? []), i]);
  });

  const cards: PathwayCard[] = [];
  const drawn = new Set<number>();

  function visit(at: number, depth: number, role: StepRole) {
    if (drawn.has(at)) return;
    drawn.add(at);
    const step = steps[at];
    const from = step.from ?? [];
    const shared: string[] = [];
    cards.push({ step, at, role, depth, startsHere: from.length === 0, sharedFrom: shared });
    for (const id of from) {
      const child = indexOfOutcome.get(id);
      if (child === undefined) continue;
      if (drawn.has(child)) shared.push(id);
      else visit(child, depth + 1, "precondition");
    }
    for (const child of childrenPending.get(step.id ?? "") ?? []) {
      visit(child, depth + 1, "precondition");
    }
  }

  // A step nothing waits on ends a pathway. Walked from the back, since
  // the file is written earliest-first and the outcome is the last line.
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    const claimed = s.outcome ? waitedOn.has(s.outcome) : false;
    const isChild = s.id ? Boolean(pending[s.id]) : false;
    if (!claimed && !isChild) visit(i, 0, "outcome");
  }
  // Anything left is reachable from nothing drawn yet: a step whose
  // outcome somebody waits on, in a fragment of its own.
  for (let i = steps.length - 1; i >= 0; i--) visit(i, 0, "outcome");

  return cards;
}

/**
 * The outcomes one step may also rest on: every other step's, minus the
 * ones that already depend on it.
 *
 * This is for the case creation cannot cover — a precondition two steps
 * both need. Offering an outcome that waits on this step is offering a
 * loop, and a pathway that closes on itself has no first step, which the
 * kind rule refuses on save.
 */
export function canRestOn(steps: PathwayStep[], at: number): string[] {
  const self = steps[at]?.outcome;
  const dependsOnSelf = new Set<string>();
  if (self) {
    const queue = [self];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const s of steps) {
        if (!s.outcome || dependsOnSelf.has(s.outcome)) continue;
        if ((s.from ?? []).includes(id)) {
          dependsOnSelf.add(s.outcome);
          queue.push(s.outcome);
        }
      }
    }
  }

  return steps
    .map((s) => s.outcome)
    .filter((id, i): id is string => Boolean(id) && i !== at && !dependsOnSelf.has(id!));
}

/** An id for a step being created, unique among the ones already there. */
export function nextStepID(steps: PathwayStep[]): string {
  const taken = new Set(steps.map((s) => s.id));
  for (let n = 1; ; n++) {
    const id = `step-${n}`;
    if (!taken.has(id)) return id;
  }
}
