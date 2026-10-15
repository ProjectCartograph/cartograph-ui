import { describe, expect, it, vi } from "vitest";

import type { Client } from "@/client/port";
import { mergeChangeSet } from "../merge";
import { namesAfter } from "../names";

// Merge is one step for the person: their own change set is still open,
// so it is proposed and then accepted; one an agent proposed is accepted.
describe("merging a change set", () => {
  it("proposes an open change set before accepting it", async () => {
    const calls: string[] = [];
    const client = {
      proposeChangeSet: vi.fn(async () => void calls.push("propose")),
      acceptChangeSet: vi.fn(async () => void calls.push("accept")),
    } as unknown as Client;
    await mergeChangeSet(client, "cs1", "open");
    expect(calls).toEqual(["propose", "accept"]);
    calls.length = 0;
    await mergeChangeSet(client, "cs2", "proposed");
    expect(calls).toEqual(["accept"]);
  });
});

// A change set is named after the work it defines, not the first record a
// walk touched (cartograph-ui#90).
describe("what a change set is named after", () => {
  it("names it after the project its walk defines", () => {
    expect(namesAfter([{ kind: "Gap", id: "g" }, { kind: "Goal", id: "o" }, { kind: "Project", id: "p" }])?.id).toBe("p");
  });
  it("names it after its first item when it defines no work", () => {
    expect(namesAfter([{ kind: "Gap", id: "g" }, { kind: "Goal", id: "o" }])?.id).toBe("g");
    expect(namesAfter([])).toBeUndefined();
  });
});
