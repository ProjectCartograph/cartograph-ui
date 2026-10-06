/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { copy } from "@/copy";
import { FlowProgress } from "../walker";

// Every flow shows its progress the same way: a segment per step or
// stage, filled by how much of it is done, its worst check marked, the one
// in hand current, each open to go to unless it may not be yet.
describe("a flow's progress", () => {
  const segments = [
    { key: "a", label: "Context", share: 1, state: "ok" as const },
    { key: "b", label: "Problem", share: 0.5, state: "block" as const },
    { key: "c", label: "Plan" },
  ];

  it("marks the step in hand, and each segment's worst state", () => {
    render(<FlowProgress segments={segments} at={1} onGo={() => {}} label="Stages" />);
    expect(screen.getByRole("button", { name: /Problem/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByLabelText(copy.flow.blocked)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.flow.done)).toBeInTheDocument();
    const fills = document.querySelectorAll<HTMLElement>('[data-slot="flow-progress"] span.origin-left');
    expect([...fills].map((f) => f.style.transform)).toEqual(["scaleX(1)", "scaleX(0.5)", "scaleX(0)"]);
  });

  it("goes where it is asked, and nowhere it may not yet", () => {
    const onGo = vi.fn();
    render(<FlowProgress segments={segments} at={0} onGo={onGo} label="Stages" canGo={(i) => i < 2} />);
    fireEvent.click(screen.getByRole("button", { name: /Problem/ }));
    fireEvent.click(screen.getByRole("button", { name: /Plan/ }));
    expect(onGo.mock.calls).toEqual([[1]]);
  });
});
