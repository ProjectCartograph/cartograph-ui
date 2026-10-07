import { describe, expect, it, vi } from "vitest";

import type { Client } from "@/client/port";
import type { ProjectSpec } from "../../types";
import { linkFor, setLink, type MapNode } from "../links";

const node = (kind: string, id: string, extra: Partial<MapNode> = {}): MapNode => ({ key: `${kind}/${id}`, kind, id, name: id, ...extra });

// A drag on the map makes the link the definition holds between those two
// kinds, saved where that record keeps it.
describe("links drawn on the project map", () => {
  it("names the link a pair of kinds makes, and none for a pair that makes none", () => {
    expect(linkFor(node("Problem", "p1"), node("Gap", "g"))).toBe("problem-gap");
    expect(linkFor(node("Gap", "g"), node("BeneficiaryGroup", "b"))).toBe("gap-group");
    expect(linkFor(node("Goal", "o"), node("Goal", "obj"))).toBe("goal-parent");
    expect(linkFor(node("BeneficiaryGroup", "b"), node("Gap", "g"))).toBeUndefined();
  });

  it("saves a problem's group on the project, among its beneficiaries too", async () => {
    let spec = { summary: { problems: [{ id: "p1", problem: {}, change: {} }], beneficiaries: [] } } as unknown as ProjectSpec;
    const update = (fn: (s: ProjectSpec) => ProjectSpec) => (spec = fn(spec));
    await setLink({} as Client, update, () => 0, "problem-group", node("Problem", "p1", { problem: "p1" }), node("BeneficiaryGroup", "growers"), true);
    expect(spec.summary.problems[0].groups).toEqual(["growers"]);
    expect(spec.summary.beneficiaries).toEqual([{ group: "growers" }]);
  });

  it("saves a gap's group on the gap, in the change set", async () => {
    const saveWorking = vi.fn(async () => undefined);
    const client = { get: vi.fn(async () => ({ yaml: "kind: Gap\nspec:\n  affects: [buyers]\n" })), saveWorking } as unknown as Client;
    await setLink(client, () => undefined, () => 0, "gap-group", node("Gap", "g"), node("BeneficiaryGroup", "growers"), true);
    const [kind, id, yaml] = saveWorking.mock.calls[0] as unknown as [string, string, string];
    expect([kind, id]).toEqual(["Gap", "g"]);
    expect(yaml).toContain("growers");
    expect(yaml).toContain("buyers");
  });
});
