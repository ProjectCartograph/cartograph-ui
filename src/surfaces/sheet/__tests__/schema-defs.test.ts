import { describe, expect, it } from "vitest";

import { parseSpecFields } from "../schema";

// The engine serves a kind's schema with the definitions it uses (engine
// #89): a field pointing at one reads as what that definition says.
describe("a field defined elsewhere in its schema", () => {
  it("reads as its definition: a Day is a date", () => {
    const doc = {
      properties: { spec: { properties: { startDate: { $ref: "#/$defs/Day", description: "The first day." } } } },
      $defs: { Day: { type: "string", format: "date" } },
    };
    expect(parseSpecFields(doc)).toEqual([expect.objectContaining({ name: "startDate", kind: "string", format: "date" })]);
  });
});
