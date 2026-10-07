import { describe, expect, it } from "vitest";

import { specValue } from "../SheetForm";

// A choice among numbers is saved as the number: a reporting cycle saved
// as "1" failed its schema and no screen could fix it.
describe("a sheet field's saved value", () => {
  it("saves a numeric choice as a number, and text as text", () => {
    expect(specValue({ kind: "enum", enumValues: [1, 3, 6, 12] }, "3")).toBe(3);
    expect(specValue({ kind: "enum", enumValues: ["monthly", "termly"] }, "termly")).toBe("termly");
    expect(specValue({ kind: "integer" }, "12")).toBe(12);
    expect(specValue({ kind: "string" }, "12")).toBe("12");
  });
});
