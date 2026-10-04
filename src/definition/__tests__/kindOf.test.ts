import { describe, it, expect } from "vitest";

import { copy } from "@/copy";
import { kindOf } from "../kindOf";

// The questions every standard asks first (TAXONOMY.md D14, D15, D30,
// D32), one yes-or-no at a time.
describe("what are you describing", () => {
  it("splits work that keeps running by whether it runs today", () => {
    expect(kindOf({ ends: "runs", today: "today" })).toBe("operation");
    expect(kindOf({ ends: "runs", today: "new" })).toBe("service");
    expect(kindOf({ ends: "runs", inCharge: "many" })).toBeNull();
  });

  it("splits work with one person in charge by whether it is a part", () => {
    expect(kindOf({ ends: "finishes", inCharge: "one" })).toBeNull();
    expect(kindOf({ ends: "finishes", inCharge: "one", partOf: "own" })).toBe("project");
    expect(kindOf({ ends: "finishes", inCharge: "one", partOf: "part" })).toBe("component");
  });

  it("tells several projects apart by why they are together, not by being grouped", () => {
    const many = { ends: "finishes", inCharge: "many" } as const;
    expect(kindOf(many)).toBeNull();
    expect(kindOf({ ...many, together: "yes" })).toBe("programme");
    expect(kindOf({ ...many, together: "no" })).toBeNull();
    expect(kindOf({ ...many, together: "no", funds: "yes" })).toBe("portfolio");
    expect(kindOf({ ...many, together: "no", funds: "no" })).toBe("collection");
    // A programme is never asked about funding, nor whether it is a part.
    expect(kindOf({ ...many, together: "yes", funds: "no", partOf: "part" })).toBe("programme");
  });

  it("waits for each answer", () => {
    expect(kindOf({ ends: "finishes" })).toBeNull();
    expect(kindOf({ ends: "runs" })).toBeNull();
    expect(kindOf({})).toBeNull();
  });

  it("has a verdict, a reason and a next step for every kind", () => {
    for (const k of ["project", "component", "programme", "portfolio", "collection", "operation", "service"]) {
      expect(copy.newWork.verdict[k]).toBeTruthy();
      expect(copy.newWork.because[k]).toBeTruthy();
      expect(copy.newWork.start[k]).toBeTruthy();
    }
  });
});
