/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef } from "react";

import { copy } from "@/copy";
import { SectionOutline } from "../SectionOutline";

const so = copy.projects.outline;

function Stage({ onNext }: { onNext: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  return (
    <div ref={root}>
      <SectionOutline root={root} onNext={onNext} />
      <h2>Roles</h2>
      <input aria-label="Role" />
      <h2>Funding</h2>
      <input aria-label="Amount" />
      <h2>Stakeholders</h2>
      <input aria-label="Stake" />
    </div>
  );
}

// A long stage is moved through from the keyboard (#32): an outline of
// its headings, Alt+Down to the next with the cursor in its first field,
// Ctrl+Enter for the next step.
describe("moving through a stage", () => {
  it("outlines the headings, jumps a section, and takes the next step", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onNext = vi.fn();
    render(<Stage onNext={onNext} />);
    const nav = await screen.findByRole("navigation", { name: so.label });
    expect(nav).toHaveTextContent("Roles");
    expect(nav).toHaveTextContent("Funding");
    // The first heading sits at the top of the view, the others below it.
    const tops: Record<string, number> = { Roles: 50, Funding: 400, Stakeholders: 800 };
    for (const h of document.querySelectorAll("h2")) {
      h.getBoundingClientRect = () => ({ top: tops[h.textContent ?? ""] ?? 0 }) as DOMRect;
    }
    fireEvent.keyDown(document.body, { key: "ArrowDown", altKey: true });
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    fireEvent.keyDown(document.body, { key: "Enter", ctrlKey: true });
    expect(onNext).toHaveBeenCalled();
  });
});
