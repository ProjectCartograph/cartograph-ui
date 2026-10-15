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
    // Alt+Right moves on a section, and the browser does not go forward.
    expect(fireEvent.keyDown(document.body, { key: "ArrowRight", altKey: true })).toBe(false);
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveFocus();
    // Alt+L as in vim, by the key, whatever letter Option types on a Mac.
    expect(fireEvent.keyDown(document.body, { key: "¬", code: "KeyL", altKey: true })).toBe(false);
    // Alt+Left and Alt+H go back a section, never back a page.
    expect(fireEvent.keyDown(document.body, { key: "ArrowLeft", altKey: true })).toBe(false);
    expect(fireEvent.keyDown(document.body, { key: "˙", code: "KeyH", altKey: true })).toBe(false);
    fireEvent.keyDown(document.body, { key: "Enter", ctrlKey: true });
    expect(onNext).toHaveBeenCalled();
  });
});

// The summary of earlier steps is a reminder, not a place to go: its
// blocks are not in the outline (#91: Beneficiaries listed twice).
describe("the outline beside a summary", () => {
  it("lists the step's own headings, not the summary's", async () => {
    function WithRecap() {
      const root = useRef<HTMLDivElement>(null);
      return (
        <div ref={root}>
          <SectionOutline root={root} onNext={() => {}} />
          <section data-slot="context-recap">
            <h3>Beneficiaries</h3>
          </section>
          <h2>Problem</h2>
          <h3>Beneficiaries</h3>
        </div>
      );
    }
    render(<WithRecap />);
    const nav = await screen.findByRole("navigation", { name: so.label });
    expect(nav.textContent?.match(/Beneficiaries/g)).toHaveLength(1);
  });

  it("moves the cursor a field down and up, passing a folded section", () => {
    Element.prototype.scrollIntoView = vi.fn();
    function Fields() {
      const root = useRef<HTMLDivElement>(null);
      return (
        <div ref={root}>
          <SectionOutline root={root} />
          <h2>Roles</h2>
          <input aria-label="Role" />
          <input aria-label="Post" />
          <h2>Funding</h2>
          <div hidden>
            <input aria-label="Amount" />
          </div>
          <h2>Stakeholders</h2>
          <input aria-label="Stake" />
        </div>
      );
    }
    render(<Fields />);
    screen.getByRole("textbox", { name: "Role" }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown", altKey: true });
    expect(screen.getByRole("textbox", { name: "Post" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown", altKey: true });
    expect(screen.getByRole("textbox", { name: "Stake" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { code: "KeyK", key: "˚", altKey: true });
    expect(screen.getByRole("textbox", { name: "Post" })).toHaveFocus();
  });
});
