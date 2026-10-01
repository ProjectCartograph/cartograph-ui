import { describe, expect, it } from "vitest";

import { canRestOn, nextStepID, pathwayCards } from "../pathway";
import type { PathwayStep } from "../types";

// The file stores the chain causally, earliest first, so reading the YAML
// runs from the work up to the outcome. The screen reads the other way and
// as a tree, because that is the order somebody writes it in.
const chain: PathwayStep[] = [
  { id: "step-3", outcome: "checkers-agree" },
  { id: "step-2", outcome: "faults-found-early", from: ["checkers-agree"] },
  { id: "step-1", outcome: "one-standard", from: ["faults-found-early"] },
];

describe("the pathway as it is authored", () => {
  it("puts the outcome first and indents what it rests on", () => {
    expect(pathwayCards(chain).map((c) => [c.step.outcome, c.depth])).toEqual([
      ["one-standard", 0],
      ["faults-found-early", 1],
      ["checkers-agree", 2],
    ]);
  });

  // Read off the graph rather than off the position: the step nothing
  // else waits on is where the pathway ends.
  it("names only the step nothing waits on the outcome", () => {
    expect(pathwayCards(chain).map((c) => c.role)).toEqual([
      "outcome",
      "precondition",
      "precondition",
    ]);
  });

  it("keeps the stored position, so an edit lands on the right step", () => {
    expect(pathwayCards(chain).map((c) => c.at)).toEqual([2, 1, 0]);
  });

  // The moment between "add what has to hold before this" and picking a
  // goal for it. Without the pairing the new step waits on nothing and
  // nothing waits on it, so the graph alone would call it an outcome --
  // which is what it was called, and it read as nonsense (Programme Lead,
  // 2026-09-29).
  it("calls a step created under another a precondition before it has a goal", () => {
    const steps: PathwayStep[] = [{ id: "step-2" }, { id: "step-1", outcome: "one-standard" }];
    const cards = pathwayCards(steps, { "step-2": "step-1" });
    expect(cards.map((c) => [c.step.id, c.role, c.depth])).toEqual([
      ["step-1", "outcome", 0],
      ["step-2", "precondition", 1],
    ]);
  });

  it("marks the step nothing on the pathway comes before", () => {
    expect(pathwayCards(chain).map((c) => c.startsHere)).toEqual([false, false, true]);
  });

  // A programme may reach more than one outcome, and neither is the
  // precondition of the other.
  it("allows more than one outcome", () => {
    const forked: PathwayStep[] = [
      { outcome: "checkers-agree" },
      { outcome: "one-standard", from: ["checkers-agree"] },
      { outcome: "fewer-returns", from: ["checkers-agree"] },
    ];
    const cards = pathwayCards(forked);
    expect(cards.filter((c) => c.role === "outcome")).toHaveLength(2);
    // The shared precondition is drawn once, under the first outcome that
    // claims it, and mentioned by the other.
    expect(cards.filter((c) => c.step.outcome === "checkers-agree")).toHaveLength(1);
    expect(cards.find((c) => c.step.outcome === "one-standard")?.sharedFrom).toEqual([
      "checkers-agree",
    ]);
  });
});

describe("what a step may also rest on", () => {
  it("offers the outcomes that do not wait on it", () => {
    // one-standard waits on this step, so only the step before it is
    // left to rest on.
    expect(canRestOn(chain, 1)).toEqual(["checkers-agree"]);
  });

  // Offering an outcome that already waits on this one is offering a
  // loop, and a pathway that closes on itself has no first step.
  it("never offers something that already waits on it", () => {
    expect(canRestOn(chain, 0)).toEqual([]);
  });

  it("offers nothing when there is nothing else", () => {
    expect(canRestOn([{ outcome: "one-standard" }], 0)).toEqual([]);
  });
});

describe("a new step's id", () => {
  it("is the first one not already taken", () => {
    expect(nextStepID([])).toBe("step-1");
    expect(nextStepID(chain)).toBe("step-4");
    expect(nextStepID([{ id: "step-2" }])).toBe("step-1");
  });
});
