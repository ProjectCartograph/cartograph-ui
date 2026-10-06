import { describe, it, expect } from "vitest";

import type { CyclePeriod } from "@/client/port";
import { periodLabel, readingSlots, readingSpan } from "../periods";

// What the engine lays out for a quarterly cycle over 2026, and for terms.
const quarters: CyclePeriod[] = ["2025-12", "2026-03", "2026-06", "2026-09", "2026-12"].map((end) => ({
  end,
  start: end,
  due: `${end}-28`,
}));
const terms: CyclePeriod[] = [
  { end: "2026-12", start: "2026-08", name: "Term I", label: "Term I 2026/27", due: "2027-01-14" },
  { end: "2027-04", start: "2027-01", name: "Term II", label: "Term II 2026/27", due: "2027-05-14" },
];

describe("the months a KPI asks about", () => {
  it("span the baseline, the target and every reading", () => {
    expect(readingSpan([{ period: "2027-03", value: 1 }], "2025-12", "2026-12")).toEqual({ from: "2025-12", to: "2027-03" });
  });

  it("are nothing when there is nothing to span", () => {
    expect(readingSpan([])).toBeNull();
  });
});

describe("the slots a KPI shows", () => {
  const readings = [
    { period: "2026-03", value: 61 },
    { period: "2026-09", value: 64, provisional: true },
  ];

  it("carries each reading in its period", () => {
    const slots = readingSlots(quarters, readings);
    expect(slots.map((s) => s.period)).toEqual(["2025-12", "2026-03", "2026-06", "2026-09", "2026-12"]);
    expect(slots[1].reading?.value).toBe(61);
    // A period nobody has read yet is empty, not zero.
    expect(slots[2].reading).toBeUndefined();
    expect(slots[3].reading?.provisional).toBe(true);
  });

  it("keeps a reading that falls outside the cycle rather than dropping it", () => {
    // Somebody recorded a number mid-quarter. It is still their number.
    const slots = readingSlots(quarters, [...readings, { period: "2026-05", value: 62 }]);
    expect(slots.map((s) => s.period)).toContain("2026-05");
    expect(slots.map((s) => s.period)).toEqual([...slots.map((s) => s.period)].sort());
  });

  it("reads a named period by its name and an equal one by its month", () => {
    const [termOne] = readingSlots(terms, []);
    expect(periodLabel(termOne)).toBe("Term I 2026/27");
    expect(periodLabel(readingSlots(quarters, [])[0])).toBe("2025-12");
  });

  it("says nothing when there is nothing to say", () => {
    expect(readingSlots([], [])).toEqual([]);
  });
});
