import { describe, it, expect } from "vitest";

import { copy } from "@/copy";
import { kindOf } from "../kindOf";

// The questions every standard asks first (TAXONOMY.md D14, D15, D30).
// The case that started this: a national assessment that runs every year
// is a service, and the work to set one up is a project that hands over to
// it, recorded after the service it sets up.
describe("what are you describing", () => {
  it("splits work that keeps running by whether it runs today", () => {
    expect(kindOf("runs", "today")).toBe("operation");
    expect(kindOf("runs", "new")).toBe("service");
    expect(kindOf("runs", "many")).toBeNull();
  });

  it("splits work that finishes by who answers for it", () => {
    expect(kindOf("finishes", "one")).toBe("project");
    expect(kindOf("finishes", "part")).toBe("component");
    expect(kindOf("finishes", "many")).toBe("programme");
    expect(kindOf("finishes", "today")).toBeNull();
  });

  it("waits for the second answer", () => {
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
