/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/copy";
import { DefinitionCheckPanel, type AdvisoryCheck } from "../CheckPanel";

const dc = copy.definition.checks;

const items: AdvisoryCheck[] = [
  {
    id: "members-present",
    section: "members",
    state: "warn",
    message: "No project or operation names this programme yet.",
  },
  { id: "problems-stated", section: "problems", state: "ok", message: "2 problems stated." },
  {
    id: "problems-groups",
    section: "problems",
    state: "warn",
    message: "1 problem names nobody it lands on.",
  },
  {
    id: "problems-gaps",
    section: "problems",
    state: "ok",
    message: "Every problem cites the evidence for it.",
  },
];

describe("the advisory check panel", () => {
  it("shows only the checks about the step on screen", () => {
    render(<DefinitionCheckPanel items={items} loading={false} section="members" />);
    expect(screen.getByText(items[0].message)).toBeInTheDocument();
    expect(screen.queryByText(items[2].message)).not.toBeInTheDocument();
  });

  it("keeps what is settled behind a count, and what is not in the open", async () => {
    render(<DefinitionCheckPanel items={items} loading={false} section="problems" />);
    expect(screen.getByText(items[2].message)).toBeInTheDocument();
    // Two settled lines, collapsed to one control rather than printed.
    expect(screen.queryByText(items[1].message)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: dc.showPassed(2) }));
    expect(screen.getByText(items[1].message)).toBeInTheDocument();
    expect(screen.getByText(items[3].message)).toBeInTheDocument();
  });

  it("says nothing outstanding rather than nothing at all", () => {
    render(
      <DefinitionCheckPanel
        items={[{ id: "a", section: "aim", state: "ok", message: "Fine." }]}
        loading={false}
        section="aim"
      />,
    );
    expect(screen.getByText(dc.allDone)).toBeInTheDocument();
    // With nothing to fix there is nothing to expand, so no control.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders no panel for a step nothing is said about", () => {
    const { container } = render(
      <DefinitionCheckPanel items={items} loading={false} section="teams" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("never renders a blocking state, because these checks cannot block", () => {
    // The contract has no block state for these. If one ever arrives it
    // must not render as a refusal by accident.
    render(
      <DefinitionCheckPanel
        items={[{ id: "a", section: "aim", state: "block", message: "Should not refuse." }]}
        loading={false}
        section="aim"
      />,
    );
    expect(screen.getByText(dc.allDone)).toBeInTheDocument();
    expect(screen.queryByText("Should not refuse.")).not.toBeInTheDocument();
  });
});
