/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChipPicker, type ChipItem } from "../ChipPicker";

// Grouped: a register with a shape, the way goals have one.
const items: ChipItem[] = [
  { id: "a", label: "Implement process automation", group: "Service Quality", tag: "Operational efficiency" },
  { id: "b", label: "Conduct quarterly review", group: "Service Quality", tag: "Operational efficiency" },
  { id: "c", label: "Establish feedback mechanisms", group: "Service Quality", tag: "Stakeholder engagement" },
  { id: "d", label: "Upgrade cold storage", group: "Dependable Supply", tag: "Cut losses" },
];

// Flat: a register with none, the way beneficiary groups have none.
const flat: ChipItem[] = [
  { id: "x", label: "Delivering members" },
  { id: "y", label: "Depot staff" },
];

function setup(selected: string[] = []) {
  const onToggle = vi.fn();
  render(
    <ChipPicker
      items={items}
      selected={selected}
      onToggle={onToggle}
      placeholder="Goal or area"
      empty="No goal matches."
      slot="chips"
    />,
  );
  const chip = (label: string) => screen.getByRole("button", { name: new RegExp(label) });
  return { onToggle, chip };
}

describe("ChipPicker", () => {
  it("renders one chip per item, with the ancestry as headings and not on the chips", () => {
    setup();
    for (const item of items) expect(screen.getByText(item.label)).toBeInTheDocument();
    // Two goals share an area: the area is written once, above them.
    expect(screen.getAllByText("Operational efficiency")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Service Quality" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dependable Supply" })).toBeInTheDocument();
  });

  it("keeps every branch in register order, each with its own areas", () => {
    setup();
    const groups = Array.from(document.querySelectorAll('[data-slot="chip-group"]'));
    expect(groups.map((g) => g.querySelector("h3")?.textContent)).toEqual([
      "Service Quality",
      "Dependable Supply",
    ]);
    const areas = Array.from(groups[0].querySelectorAll('[data-slot="chip-area"]'));
    expect(areas.map((a) => a.querySelector("p")?.textContent)).toEqual([
      "Operational efficiency",
      "Stakeholder engagement",
    ]);
  });

  it("drops a whole branch when a search leaves nothing in it", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByPlaceholderText("Goal or area"), "cold");
    expect(screen.getByRole("heading", { name: "Dependable Supply" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Service Quality" })).not.toBeInTheDocument();
  });

  it("finds a branch by its pillar name as well as by its area", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByPlaceholderText("Goal or area"), "dependable");
    expect(screen.getByText("Upgrade cold storage")).toBeInTheDocument();
    expect(screen.queryByText("Conduct quarterly review")).not.toBeInTheDocument();
  });

  it("reports the chip clicked when it is not yet picked", async () => {
    const user = userEvent.setup();
    const { onToggle, chip } = setup([]);
    await user.click(chip("Implement process automation"));
    expect(onToggle).toHaveBeenCalledWith("a");
  });

  it("reports the same chip clicked when it is picked, so a click removes it", async () => {
    const user = userEvent.setup();
    const { onToggle, chip } = setup(["a"]);
    await user.click(chip("Implement process automation"));
    expect(onToggle).toHaveBeenCalledWith("a");
  });

  it("marks a picked chip pressed, and leaves the rest unpressed", () => {
    const { chip } = setup(["c"]);
    expect(chip("Establish feedback mechanisms")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Conduct quarterly review")).toHaveAttribute("aria-pressed", "false");
  });

  it("searches a goal's own name and its tag alike", async () => {
    const user = userEvent.setup();
    setup();
    const search = screen.getByPlaceholderText("Goal or area");

    await user.type(search, "quarterly");
    expect(screen.getByText("Conduct quarterly review")).toBeInTheDocument();
    expect(screen.queryByText("Establish feedback mechanisms")).not.toBeInTheDocument();

    await user.clear(search);
    // The tag is the point of the chips: typing an area narrows to it,
    // which is what the goal tree's headings used to be for.
    await user.type(search, "stakeholder");
    expect(screen.getByText("Establish feedback mechanisms")).toBeInTheDocument();
    expect(screen.queryByText("Conduct quarterly review")).not.toBeInTheDocument();
  });

  it("keeps a picked chip on screen through a search that excludes it", async () => {
    const user = userEvent.setup();
    const { chip } = setup(["a"]);
    await user.type(screen.getByPlaceholderText("Goal or area"), "stakeholder");
    // Losing sight of the selection is what the old second panel prevented.
    expect(chip("Implement process automation")).toHaveAttribute("aria-pressed", "true");
  });

  it("leaves a grouped chip where it belongs rather than sorting it to the front", () => {
    setup(["c"]);
    const areas = Array.from(document.querySelectorAll('[data-slot="chip-area"]'));
    const picked = areas.find((a) => a.textContent?.includes("Establish feedback mechanisms"));
    // Moving it would break the one thing the grouping is for.
    expect(picked?.querySelector("p")?.textContent).toBe("Stakeholder engagement");
  });

  it("sorts picked chips to the front of a flat register, where there is no shape to keep", () => {
    render(
      <ChipPicker
        items={flat}
        selected={["y"]}
        onToggle={vi.fn()}
        placeholder="Group"
        empty="No group matches."
      />,
    );
    expect(document.querySelector('[data-slot="chip-group"]')).not.toBeInTheDocument();
    const labels = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(labels[0]).toContain("Depot staff");
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByPlaceholderText("Goal or area"), "zzz");
    expect(screen.getByText("No goal matches.")).toBeInTheDocument();
  });

  it("offers the add button only when a caller hands it one", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <ChipPicker
        items={items}
        selected={[]}
        onToggle={vi.fn()}
        placeholder="Group"
        empty="No group matches."
        addLabel="Add a group"
        onAdd={onAdd}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add a group" }));
    expect(onAdd).toHaveBeenCalled();
  });
});

// A long register reads as its headings: a branch opens when it holds a
// pick, when searched, or by hand (#29).
describe("a long register", () => {
  it("starts with only the branches that hold a pick open", async () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, label: `Outcome ${i}`, group: i < 6 ? "Pillar A" : "Pillar B", tag: "Area" }));
    render(<ChipPicker items={items} selected={["g7"]} onToggle={() => {}} placeholder="Search" empty="None" />);
    const a = screen.getByRole("button", { name: /Pillar A/ });
    const b = screen.getByRole("button", { name: /Pillar B/ });
    expect(a).toHaveAttribute("aria-expanded", "false");
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("Outcome 0")).toBeNull();
    await userEvent.click(a);
    expect(screen.getByText("Outcome 0")).toBeInTheDocument();
  });
});
