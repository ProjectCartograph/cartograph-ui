/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { copy } from "@/copy";
import { RiskMatrix, severityOf } from "../RiskMatrix";
import type { Risk } from "../types";

// The app mounts one TooltipProvider at the root; a component rendered
// on its own needs the same.
function render(ui: React.ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>, {
    wrapper: ({ children }) => <>{children}</>,
  });
}

const rc = copy.projects.risks;

const risks: Risk[] = [
  { id: "r-1", description: "Vendor delay", type: "risk", impact: "high", likelihood: "high",
    escalate: { flag: true, reason: "Board attention" } },
  { id: "r-2", description: "Late returns", type: "issue", impact: "high", likelihood: "high" },
  { id: "r-3", description: "Low uptake", type: "risk", impact: "low", likelihood: "low" },
  { id: "r-4", description: "Not placed yet", type: "risk" },
];

describe("severity is derived from position, not from the data", () => {
  it("bands the nine cells into four levels", () => {
    expect(severityOf("low", "low")).toBe(1);
    expect(severityOf("low", "medium")).toBe(1);
    expect(severityOf("medium", "medium")).toBe(2);
    expect(severityOf("low", "high")).toBe(2);
    expect(severityOf("high", "medium")).toBe(3);
    expect(severityOf("high", "high")).toBe(4);
  });

  it("is symmetric: impact and likelihood weigh the same", () => {
    expect(severityOf("high", "low")).toBe(severityOf("low", "high"));
    expect(severityOf("high", "medium")).toBe(severityOf("medium", "high"));
  });
});

describe("the matrix reads without colour", () => {
  it("gives every cell a count and an accessible name", () => {
    render(<RiskMatrix risks={risks} />);
    const cells = document.querySelectorAll('[data-slot="risk-cell"]');
    expect(cells).toHaveLength(9);
    // The worst corner holds two, the calm corner one, the rest none.
    const counts = Array.from(cells).map((c) => c.getAttribute("data-count"));
    expect(counts.filter((c) => c !== "0")).toEqual(["2", "1"]);
    expect(screen.getByLabelText(/Critical: high impact, high likelihood, 2 here/)).toBeInTheDocument();
  });

  it("carries a legend, so a fill never stands alone", () => {
    render(<RiskMatrix risks={risks} />);
    for (const level of [1, 2, 3, 4]) {
      expect(screen.getAllByText(rc.severity[level]).length).toBeGreaterThan(0);
    }
  });

  it("says how many risks are not on the grid", () => {
    render(<RiskMatrix risks={risks} />);
    expect(screen.getByText(rc.unplaced(1))).toBeInTheDocument();
  });

  // Escalation is a state, not a magnitude, so it is a mark in the theme's
  // one chromatic token rather than another step of the ramp.
  it("marks escalation separately from severity", () => {
    render(<RiskMatrix risks={risks} />);
    const worst = screen.getByLabelText(/Critical/);
    expect(worst.querySelector("svg.text-destructive")).not.toBeNull();
    const calm = screen.getByLabelText(/Low: low impact, low likelihood/);
    expect(calm.querySelector("svg.text-destructive")).toBeNull();
  });

  it("only takes a click when a risk has been chosen to place", () => {
    const { rerender } = rtlRender(
      <TooltipProvider>
        <RiskMatrix risks={risks} />
      </TooltipProvider>,
    );
    expect(screen.getByLabelText(/Critical/)).toBeDisabled();
    rerender(
      <TooltipProvider>
        <RiskMatrix risks={risks} selected={0} />
      </TooltipProvider>,
    );
    expect(screen.getByLabelText(/Critical/)).toBeEnabled();
  });
});
