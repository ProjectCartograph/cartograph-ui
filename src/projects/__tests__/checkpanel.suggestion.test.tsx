/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { CheckPanel } from "../CheckPanel";

const cc = copy.projects.checks;

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }));

const fix = { phase: "initiation" as const, section: "goals" };
const items = [
  { id: "goals-aligned", section: "goals", phase: "initiation" as const, state: "ok" as const, message: "Serves 1 outcome: Members are paid within a week.", fix },
  { id: "goals-outcome-fit", section: "goals", phase: "initiation" as const, state: "ok" as const, suggestion: true, message: 'The objective may not work toward "Members are paid within a week". Look again at the outcome, or at the objective.', fix },
  { id: "goals-objective-aim", section: "measures", phase: "initiation" as const, state: "ok" as const, notJudged: true, message: "Not judged: whether the objective reads as a target is the decision model's to judge, and it is off (CARTOGRAPH_DECIDE=off).", fix },
];

// Advice from the decision model is shown apart, marked by its look and
// never by a word, and is not counted as met; a judgement not made is
// neither a tick nor a fault (engine #67).
describe("the checks panel", () => {
  it("shows a suggestion apart, and counts neither it nor what was not judged", async () => {
    render(
      <ClientProvider client={fakeClient({ checks: (async () => ({ blocking: false, items })) as never })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <CheckPanel id="p1" draft />
        </QueryClientProvider>
      </ClientProvider>,
    );
    const suggestion = (await screen.findByText(/may not work toward/)).closest("li")!;
    expect(suggestion).toHaveAttribute("data-suggestion");
    expect(suggestion.className).toContain("border-dashed");
    expect(suggestion.textContent).not.toMatch(/suggest/i);
    // What was not judged is shown beside it, neither a tick nor a fault.
    expect(screen.getByText(/^Not judged/).closest("li")).toHaveAttribute("data-not-judged");
    // One met: the alignment.
    expect(screen.getByTitle(cc.countDone(1))).toBeInTheDocument();
  });
});
