import { describe, expect, it, vi } from "vitest";

import type { Client } from "@/client/port";
import { mergeChangeSet } from "../merge";

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
