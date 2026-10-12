import { describe, expect, it } from "vitest";

import { isApproved } from "../approved";

const signOffs = [{ id: "s1", stage: "definition" as const, role: { local: "resources" as const, id: "sponsor" } }];
const signed = (decision: "approve" | "reject") => [{ id: "e1", on: { local: "signOffs" as const, id: "s1" }, happened: "signed" as const, date: "2026-10-12", decision }];

// The walk ends at Approval until the definition is signed (engine #80).
describe("an approved definition", () => {
  it("is one whose definition sign-off is signed", () => {
    expect(isApproved({ signOffs })).toBe(false);
    expect(isApproved({ signOffs, events: signed("approve") })).toBe(true);
  });
  it("is not one signed as refused", () => {
    expect(isApproved({ signOffs, events: signed("reject") })).toBe(false);
  });
});
