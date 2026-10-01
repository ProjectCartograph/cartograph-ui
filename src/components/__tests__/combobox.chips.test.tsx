/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ComboboxMultiple } from "@/components/ui/combobox";

/**
 * Two long names in one picker used to run a quarter of the way out of
 * the card they were in (Programme Lead, 2026-09-29, on a programme
 * citing two gaps).
 *
 * The cause was one class in the wrong place: `flex-wrap` sat on the
 * trigger button, whose children are the content row and the chevron, so
 * the row itself never wrapped and the chips pushed it wide. A layout
 * bug cannot be measured in jsdom, so what is held here is the shape that
 * makes the layout possible: the chips are in a row that wraps, and each
 * can shrink.
 */
describe("a picker holding several long names", () => {
  const options = [
    { value: "a", label: "Governance responsibilities are distributed across several bodies at once" },
    { value: "b", label: "Depot training remains fragmented and insufficiently aligned with what a checker needs" },
  ];

  it("wraps its chips rather than widening the field", () => {
    render(
      <ComboboxMultiple
        options={options}
        value={["a", "b"]}
        onValueChange={() => {}}
        emptyText="none"
        aria-label="Gaps it answers"
      />,
    );

    const chips = screen.getAllByText(/Governance responsibilities|Depot training/);
    expect(chips).toHaveLength(2);

    // The row the chips sit in, which is the trigger's content.
    const row = chips[0].closest("[data-slot=combobox-chip]")?.parentElement;
    expect(row?.className).toContain("flex-wrap");
    expect(row?.className).toContain("min-w-0");

    // Each chip can shrink inside that row, and wears the ellipsis on a
    // block of its own: `truncate` on the chip itself would do nothing,
    // since the chip is a flex container.
    const chip = chips[0].closest("[data-slot=combobox-chip]")!;
    expect(chip.className).toContain("min-w-0");
    expect(chip.className).toContain("max-w-full");
    expect(chips[0].className).toContain("truncate");
  });
});
