/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/copy";
import { CausesFound } from "../ProblemCard";
import type { ProblemLine } from "../types";

type Causes = NonNullable<ProblemLine["problem"]["causes"]>;
const cc = copy.projects.aim.causes;

function Harness({ start }: { start: Causes }) {
  const [causes, setCauses] = useState(start);
  return <CausesFound field="/spec/summary/problems/0/problem/causes" causes={causes} onChange={setCauses} />;
}

// A cause found says what it is and what shows it, each under its own
// label, and is confirmed only by its evidence (#30).
describe("Causes found", () => {
  it("labels the cause and its evidence, and says what goes in them", () => {
    render(<Harness start={[{ cause: "The check is made after dispatch" }]} />);
    expect(screen.getByLabelText(cc.cause)).toHaveValue("The check is made after dispatch");
    expect(screen.getByLabelText(cc.evidence)).toHaveValue("");
    expect(screen.getByText(cc.hint)).toBeVisible();
  });

  it("confirms a cause only once it has evidence", async () => {
    render(<Harness start={[{ cause: "The check is made after dispatch" }]} />);
    const confirm = screen.getByRole("button", { name: cc.verifyNeedsEvidence });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(cc.evidence), "Depot logs show it");
    const ready = screen.getByRole("button", { name: cc.verifyHint });
    expect(ready).toBeEnabled();
    await userEvent.click(ready);
    expect(screen.getByRole("button", { name: cc.verifiedHint })).toHaveAttribute("aria-pressed", "true");
  });
});
