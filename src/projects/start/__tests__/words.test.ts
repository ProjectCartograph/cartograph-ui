import { describe, expect, it } from "vitest";

import { wordsWithin } from "../words";

// What a project is about keeps whole words at its limit (#90: an idea
// arrived cut mid-word, "supply meets deman").
describe("text within a length", () => {
  it("keeps whole words", () => {
    const text = "We want to build a customer analytics service so supply meets demand";
    expect(wordsWithin(text, 64)).toBe("We want to build a customer analytics service so supply meets");
    expect(wordsWithin(text, 200)).toBe(text);
  });
  it("cuts a single long word where it must", () => {
    expect(wordsWithin("a".repeat(20), 10)).toBe("a".repeat(10));
  });
});
