import { describe, it, expect } from "vitest";

import { copy } from "@/copy";
import { kindOf } from "../kindOf";

// The two questions every standard asks first (TAXONOMY.md D14). The case
// that started this: a national assessment that runs every year is an
// operation, and the work to set it up is a project that hands over to it.
describe("what are you describing", () => {
  it("makes work that keeps running an operation, whatever its size", () => {
    expect(kindOf("runs", null)).toBe("operation");
    expect(kindOf("runs", "many")).toBe("operation");
  });

  it("splits work that finishes by who can deliver it", () => {
    expect(kindOf("finishes", "one")).toBe("project");
    expect(kindOf("finishes", "part")).toBe("component");
    expect(kindOf("finishes", "many")).toBe("programme");
  });

  it("waits for the second answer", () => {
    expect(kindOf("finishes", null)).toBeNull();
    expect(kindOf(null, null)).toBeNull();
  });

  it("has a verdict and a reason for every kind", () => {
    for (const k of ["project", "component", "programme", "operation"]) {
      expect(copy.newWork.verdict[k]).toBeTruthy();
      expect(copy.newWork.because[k]).toBeTruthy();
      expect(copy.newWork.start[k]).toBeTruthy();
    }
  });
});
