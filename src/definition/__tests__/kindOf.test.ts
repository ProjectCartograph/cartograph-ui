import { describe, it, expect } from "vitest";

import { copy } from "@/copy";
import { kindOf } from "../kindOf";

// The questions every standard asks first (TAXONOMY.md D14, D15, D30), one
// yes-or-no at a time.
describe("what are you describing", () => {
  it("splits work that keeps running by whether it runs today", () => {
    expect(kindOf("runs", "today")).toBe("operation");
    expect(kindOf("runs", "new")).toBe("service");
    expect(kindOf("runs", "many")).toBeNull();
  });

  it("splits work that finishes by who is in charge, then by whether it is a part", () => {
    expect(kindOf("finishes", "many")).toBe("programme");
    expect(kindOf("finishes", "one")).toBeNull();
    expect(kindOf("finishes", "one", "own")).toBe("project");
    expect(kindOf("finishes", "one", "part")).toBe("component");
    // A programme is never asked whether it is a part.
    expect(kindOf("finishes", "many", "part")).toBe("programme");
  });

  it("waits for each answer", () => {
    expect(kindOf("finishes", null)).toBeNull();
    expect(kindOf("runs", null)).toBeNull();
    expect(kindOf(null, null)).toBeNull();
  });

  it("has a verdict, a reason and a start for every kind", () => {
    for (const k of ["project", "component", "programme", "operation", "service"]) {
      expect(copy.newWork.verdict[k]).toBeTruthy();
      expect(copy.newWork.because[k]).toBeTruthy();
      expect(copy.newWork.start[k]).toBeTruthy();
    }
  });
});
