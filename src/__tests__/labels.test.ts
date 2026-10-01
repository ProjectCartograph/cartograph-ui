import { describe, it, expect } from "vitest";

import { labelKeys, mostCommonLabelKey } from "../labels";

describe("reading labels back out", () => {
  it("groups on the key most entries actually carry", () => {
    const labels = [{ pillar: "quality" }, { pillar: "access" }, { pack: "board" }];
    expect(mostCommonLabelKey(labels)).toBe("pillar");
  });

  // The same register has to group the same way twice, so a tie is broken
  // by the name rather than by whichever row was read first.
  it("breaks a tie alphabetically", () => {
    expect(mostCommonLabelKey([{ pack: "board" }, { pillar: "quality" }])).toBe("pack");
  });

  it("has nothing to group by when nothing is tagged", () => {
    expect(mostCommonLabelKey([])).toBeUndefined();
    expect(mostCommonLabelKey([{}])).toBeUndefined();
  });

  it("offers every key in use, once, in order", () => {
    expect(labelKeys([{ pillar: "q", pack: "b" }, { pillar: "a" }])).toEqual(["pack", "pillar"]);
  });
});
