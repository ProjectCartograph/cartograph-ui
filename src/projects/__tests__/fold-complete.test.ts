// A long stage folds the sections already complete as it opens, so it
// shows what is left (#32).
import { describe, expect, it } from "vitest";

import { foldedOnArrival } from "../fold";

describe("sections folded as a stage opens", () => {
  const checks = [
    { section: "governance", state: "ok" },
    { section: "governance", state: "ok" },
    { section: "resources", state: "ok" },
    { section: "resources", state: "warn" },
    { section: "stakeholders", state: "ok" },
  ];
  it("folds each section whose checks all pass", () => {
    expect([...foldedOnArrival(["governance", "resources", "stakeholders", "funding"], undefined, checks)]).toEqual(["governance", "stakeholders"]);
  });
  it("never folds the section the stage was opened at", () => {
    expect([...foldedOnArrival(["governance", "stakeholders"], "stakeholders", checks)]).toEqual(["governance"]);
  });
  it("leaves a section with no checks open", () => {
    expect(foldedOnArrival(["funding"], undefined, checks).size).toBe(0);
  });
});
