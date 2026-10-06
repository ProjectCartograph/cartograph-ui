/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { copy } from "@/copy";
import { Scrubber } from "../Scrubber";

// One control shows the whole walk: every step a mark that says how it
// stands, the one in hand marked as current, any of them a way to go there.
describe("the scrubber", () => {
  const stages = [
    { key: "a", label: "Context", steps: [{ key: "a1", label: "Alignment", state: "ok" as const }] },
    { key: "b", label: "Problem", steps: [{ key: "b1", label: "Beneficiaries", state: "block" as const }, { key: "b2", label: "Problem" }] },
  ];

  it("marks where you are and says how each step stands", () => {
    render(<Scrubber stages={stages} stage="b" step="b1" onGo={() => undefined} label="Steps" />);
    expect(screen.getByRole("button", { name: `Problem: Beneficiaries, ${copy.flow.blocked}` })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: `Context: Alignment, ${copy.flow.done}` })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: `Problem: Problem, ${copy.flow.notYet}` })).toBeInTheDocument();
  });

  it("goes to the step chosen", () => {
    const onGo = vi.fn();
    render(<Scrubber stages={stages} stage="a" step="a1" onGo={onGo} label="Steps" />);
    fireEvent.click(screen.getByRole("button", { name: `Problem: Problem, ${copy.flow.notYet}` }));
    expect(onGo).toHaveBeenCalledWith("b", "b2");
  });
});
