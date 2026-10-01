import { describe, expect, it } from "vitest";

import { aliasAfterRename, aliasFor } from "../alias";

/**
 * `metadata.id` is what references resolve against and is fixed once
 * chosen, so a short reference people actually quote needs somewhere
 * else to live (Programme Lead, 2026-09-29). It is a default that
 * follows the name, until it is not.
 */
describe("the short reference", () => {
  it("is the name as dashed lower-case words", () => {
    expect(aliasFor("Quality Check Rollout")).toBe("quality-check-rollout");
    expect(aliasFor("  Depot standards: phase 2  ")).toBe("depot-standards-phase-2");
    expect(aliasFor("")).toBe("");
  });

  it("follows a rename while it is still the old name's", () => {
    expect(aliasAfterRename("quality-check-rollout", "Quality Check Rollout", "Intake Checks")).toBe(
      "intake-checks",
    );
  });

  // Once somebody has typed one, it is theirs: a rename is not a reason
  // to throw away a code a team has been quoting for a year.
  it("keeps what somebody typed", () => {
    expect(aliasAfterRename("qcr-2026", "Quality Check Rollout", "Intake Checks")).toBe("qcr-2026");
  });

  it("fills an empty one from the new name", () => {
    expect(aliasAfterRename("", "Quality Check Rollout", "Intake Checks")).toBe("intake-checks");
  });
});
