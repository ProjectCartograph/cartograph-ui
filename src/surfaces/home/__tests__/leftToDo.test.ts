import { describe, it, expect } from "vitest";

import type { GoalTree } from "@/client/port";
import { copy } from "@/copy";
import { leftToDo } from "../leftToDo";

const lc = copy.home.left;
type Node = GoalTree["nodes"][number];
const node = (id: string, level: string, children: Node[] = [], objective?: string) =>
  ({ id, name: id, level, children, objective, keyResults: 0, aligned: {}, smart: {} }) as unknown as Node;

// What was started and not finished, as opening a workspace leaves it:
// read from the tree as it stands, so it empties as each is finished.
describe("what is left to do", () => {
  it("names each thing started and not finished, and where to finish it", () => {
    const tree = {
      levels: ["Goal", "Objective", "Outcome"],
      nodes: [node("quality", "goal", [node("one-standard", "objective", [], "Hold every depot to one standard")], "Raise produce quality"), node("buyers", "goal")],
      unplaced: [node("kept-cool", "outcome", [], "Produce is kept cool")],
    } as GoalTree;
    const left = leftToDo(tree, { vision: "Every member earns a fair living." });
    expect(left.map((l) => [l.name, l.why])).toEqual([
      [lc.purpose, lc.noMission],
      ["one-standard", lc.nothingUnder("Outcome")],
      ["buyers", lc.noAim("Goal")],
      ["buyers", lc.nothingUnder("Objective")],
      ["kept-cool", lc.unplaced],
    ]);
    expect(left[1]).toMatchObject({ to: "/goals/$id", params: { id: "one-standard" } });
  });

  it("is empty when everything started is finished, or nothing is started", () => {
    const done = { levels: [], nodes: [node("g", "goal", [node("o", "objective", [node("x", "outcome", [], "True")], "Change")], "Aim")], unplaced: [] } as unknown as GoalTree;
    expect(leftToDo(done, { vision: "v", mission: "m" })).toEqual([]);
    expect(leftToDo({ levels: [], nodes: [], unplaced: [] } as unknown as GoalTree, undefined)).toEqual([]);
  });
});
