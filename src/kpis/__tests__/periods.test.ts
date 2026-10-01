import { describe, it, expect } from "vitest";

import { periodsBetween, readingSlots } from "../periods";

const quarterly = { periodMonths: 3, startMonth: 1 };
// A financial year that begins in October, which is the case that catches
// a range-aligned implementation.
const octoberYear = { periodMonths: 12, startMonth: 10 };

describe("the periods a cycle lays out", () => {
  it("names a period by the month it ends, because that is when its number exists", () => {
    expect(periodsBetween(quarterly, "2026-01", "2026-12").map((s) => s.period)).toEqual([
      "2026-03",
      "2026-06",
      "2026-09",
      "2026-12",
    ]);
  });

  it("aligns to the cycle's own start month, not to what was asked about", () => {
    // Asked from February; the quarter it falls in still ends in March.
    expect(periodsBetween(quarterly, "2026-02", "2026-07").map((s) => s.period)).toEqual([
      "2026-03",
      "2026-06",
      "2026-09",
    ]);
  });

  it("starts a financial year in the month the cycle says", () => {
    expect(periodsBetween(octoberYear, "2026-01", "2027-06").map((s) => s.period)).toEqual([
      "2026-09",
      "2027-09",
    ]);
    expect(periodsBetween(octoberYear, "2026-01", "2027-06")[0].startsOn).toBe("2025-10");
  });

  it("returns nothing for a backwards range or a cycle of no months", () => {
    expect(periodsBetween(quarterly, "2026-06", "2026-01")).toEqual([]);
    expect(periodsBetween({ periodMonths: 0, startMonth: 1 }, "2026-01", "2026-12")).toEqual([]);
  });
});

describe("the slots a KPI shows", () => {
  const readings = [
    { period: "2026-03", value: 61 },
    { period: "2026-09", value: 64, provisional: true },
  ];

  it("spans the baseline to the target, and carries each reading in its place", () => {
    const slots = readingSlots(quarterly, readings, "2025-12", "2026-12");
    expect(slots.map((s) => s.period)).toEqual([
      "2025-12",
      "2026-03",
      "2026-06",
      "2026-09",
      "2026-12",
    ]);
    expect(slots[1].reading?.value).toBe(61);
    // A period nobody has read yet is empty, not zero.
    expect(slots[2].reading).toBeUndefined();
    expect(slots[3].reading?.provisional).toBe(true);
  });

  it("keeps a reading that falls outside the cycle rather than dropping it", () => {
    // Somebody recorded a number mid-quarter. It is still their number.
    const slots = readingSlots(
      quarterly,
      [...readings, { period: "2026-05", value: 62 }],
      "2025-12",
      "2026-12",
    );
    expect(slots.map((s) => s.period)).toContain("2026-05");
    expect(slots.map((s) => s.period)).toEqual([...slots.map((s) => s.period)].sort());
  });

  it("says nothing when there is nothing to say", () => {
    expect(readingSlots(quarterly, [])).toEqual([]);
  });
});
