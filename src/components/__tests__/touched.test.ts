import { describe, it, expect } from "vitest";

import { markTouchedOnFirstInput } from "../touched";

// A pick settles into place only once the person has done something on the
// page; a page that opens with picks already made stays still.
describe("motion waits for a person", () => {
  it("marks the page touched at the first press, and not before", () => {
    document.documentElement.classList.remove("cartograph-touched");
    markTouchedOnFirstInput();
    expect(document.documentElement.classList.contains("cartograph-touched")).toBe(false);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.documentElement.classList.contains("cartograph-touched")).toBe(true);
  });
});
