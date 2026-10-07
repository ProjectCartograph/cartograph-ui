import { describe, expect, it } from "vitest";

import { dependencyRows } from "../dependencies";

const node = (id: string, extra: object = {}) => ({ kind: "Project" as const, id, name: id, months: 1, dependents: 0, critical: false, inLoop: false, mostDependedOn: false, ...extra });
const ref = (id: string) => ({ kind: "Project" as const, id });

// The dependency map draws each piece of work a row below what lists it,
// a loop in its own tone over the critical path's, and keeps work with
// no link in a last row where a link can be drawn to it.
describe("the dependency map's rows", () => {
  it("places components below their work, and marks the critical path", () => {
    const { rows, tones, loose } = dependencyRows({
      nodes: [node("app"), node("platform"), node("alone")],
      edges: [{ from: ref("app"), to: ref("platform") }],
      loops: [],
      criticalPath: [ref("app"), ref("platform")],
      criticalMonths: 2,
    });
    expect(rows.map((r) => r.map((n) => n.id))).toEqual([["app"], ["platform"], ["alone"]]);
    expect(tones.get("Project/app>Project/platform")).toBe("critical");
    expect(loose).toBe(true);
  });

  it("draws a loop as a loop, and still ends", () => {
    const { rows, tones } = dependencyRows({
      nodes: [node("a", { inLoop: true }), node("b", { inLoop: true })],
      edges: [
        { from: ref("a"), to: ref("b") },
        { from: ref("b"), to: ref("a") },
      ],
      loops: [[ref("a"), ref("b"), ref("a")]],
      criticalPath: [],
      criticalMonths: 0,
    });
    expect(rows.flat()).toHaveLength(2);
    expect(tones.get("Project/a>Project/b")).toBe("loop");
    expect(tones.get("Project/b>Project/a")).toBe("loop");
  });
});
