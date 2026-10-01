import { describe, it, expect } from "vitest";

import { kindIcon, kindsWithIcons } from "../vocab";
import { SHEET_KINDS } from "@/surfaces/sheet/schema";

describe("a directory has a mark", () => {
  // Eight cards with a word each and nothing to tell them apart is what
  // this exists to stop; a ninth kind added without one would bring it
  // straight back.
  it("gives every sheet kind one", () => {
    const missing = SHEET_KINDS.filter((k) => !kindIcon(k));
    expect(missing).toEqual([]);
  });

  it("gives each kind its own, so two directories never read alike", () => {
    const icons = kindsWithIcons().map((k) => kindIcon(k));
    expect(new Set(icons).size).toBe(icons.length);
  });
});
