import { describe, expect, it } from "vitest";

import { newItemAt } from "../schemaAt";

// The charter adds an item as its own step adds one, so the step can
// still draw it (#84: a bare item broke the schedule).
const schema = {
  properties: {
    spec: {
      properties: {
        summary: { properties: { scopeIn: { type: "array", items: { type: "string" } } } },
        milestones: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "name", "timing"],
            properties: {
              id: { $ref: "common.schema.json#/$defs/Slug" },
              name: { type: "string" },
              timing: { $ref: "common.schema.json#/$defs/Timing" },
              owner: { $ref: "common.schema.json#/$defs/Ref" },
            },
          },
        },
      },
    },
  },
};

describe("a new item in the charter", () => {
  it("is an empty line in a list of lines", () => {
    expect(newItemAt(schema, "/spec/summary/scopeIn", ["One"])).toBe("");
  });

  it("carries what the contract requires, its id after the list's own", () => {
    expect(newItemAt(schema, "/spec/milestones", [{ id: "m1" }, { id: "m3" }])).toEqual({ id: "m4", name: "", timing: { form: "date" } });
  });
});
