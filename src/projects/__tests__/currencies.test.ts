import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { CURRENCIES } from "../currencies";

describe("the currency list", () => {
  // The picker and the contract must offer the same codes, or a person
  // picks something the server then refuses.
  it("is exactly the contract's enum", () => {
    const schema = JSON.parse(readFileSync("./contract/schemas/project.schema.json", "utf8"));
    const fromSchema: string[] =
      schema.properties.spec.properties.funding.items.properties.currency.enum;
    expect([...CURRENCIES]).toEqual(fromSchema);
  });

  it("holds only three-letter codes, each once", () => {
    expect(CURRENCIES.every((c) => /^[A-Z]{3}$/.test(c))).toBe(true);
    expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length);
  });
});
