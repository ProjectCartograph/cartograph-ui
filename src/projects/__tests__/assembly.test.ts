import { describe, it, expect } from "vitest";

import { assembly } from "../assembly";
import type { ProjectSpec } from "../types";

// What you're building (LSS_REVIEW.md, D22): each link of the results
// chain lights when that part exists in the draft, and a blank part does
// not count as written.
describe("the assembly strip", () => {
  it("starts with nothing in place", () => {
    const parts = assembly({ summary: { problems: [{ problem: {}, change: {} }] } } as ProjectSpec);
    expect(parts.map((p) => p.filled)).toEqual([false, false, false, false, false, false]);
  });

  it("lights each part as it is written, in the order the chain reads", () => {
    const spec = {
      summary: { problems: [{ problem: { situation: "Results come back months late." }, change: {} }] },
      objectives: [{ id: "o", objective: "Reduce the time to results", keyResults: [] }],
      deliverables: [{ id: "d1", name: "Answer sheet" }, { id: "d2", name: " " }],
      successCriteria: [],
      kpis: [],
      operation: "ttnla-assessment",
    } as unknown as ProjectSpec;
    const parts = assembly(spec);
    expect(parts.map((p) => p.part)).toEqual(["problem", "objective", "produces", "success", "measures", "handover"]);
    expect(parts.map((p) => p.filled)).toEqual([true, true, true, false, false, true]);
    // A deliverable with no name is not something produced yet.
    expect(parts.find((p) => p.part === "produces")?.count).toBe(1);
  });

  it("counts a component's measures as its parent's", () => {
    const parts = assembly({ summary: { problems: [] }, alignment: { partOf: "parent" } } as unknown as ProjectSpec);
    const measures = parts.find((p) => p.part === "measures");
    expect(measures?.filled).toBe(true);
    expect(measures?.inherited).toBe(true);
  });
});
