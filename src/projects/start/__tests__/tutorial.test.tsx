/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { STEPS } from "@/tour/steps";
import { TourContext } from "@/tour/tourContext";
import { StartProject } from "../StartProject";
import { pace } from "../tutorial";

const navigate = vi.fn();
let taken: (() => boolean) | null = null;
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));

const outcome = { id: "faults", name: "Faults are found before dispatch", level: "outcome", children: [], keyResults: 0, aligned: {}, smart: {} };
const tree = { levels: ["Goal", "Objective", "Outcome"], nodes: [{ id: "g", name: "Raise quality", level: "goal", keyResults: 0, aligned: {}, smart: {}, children: [{ id: "o", name: "One standard", level: "objective", keyResults: 0, aligned: {}, smart: {}, children: [outcome] }] }] };

// The tour's tutorial fills the walker in itself, typing and choosing
// from what is there, moves to each next question only on the guide's
// Next, and saves nothing: it ends on a project already in the workspace.
describe("starting a project as the tutorial", () => {
  it("fills itself in, saves nothing, and opens a project already there", async () => {
    pace.char = 1;
    pace.beat = 4;
    const saveWorking = vi.fn(async () => {});
    const saveVersion = vi.fn(async () => ({ number: 1 }) as never);
    const lists: Record<string, { id: string; name: string }[]> = {
      Gap: [{ id: "checks-differ", name: "Depots check differently" }],
      BeneficiaryGroup: [{ id: "depot-staff", name: "Depot staff" }],
      Team: [{ id: "quality", name: "Quality" }],
      Project: [{ id: "depot-checks", name: "Depot checks" }],
    };
    const client = fakeClient({
      list: async (kind: string) => (lists[kind] ?? []) as never,
      goalTree: async () => tree as never,
      relevant: async () => ({ available: false, matches: [] }),
      saveWorking,
      saveVersion,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <TourContext.Provider
            value={{ at: STEPS.findIndex((s) => s.key === "walker"), start: () => {}, go: () => {}, end: () => {}, takeNext: (h) => ((taken = h), () => (taken = null)) }}
          >
            <StartProject />
          </TourContext.Provider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(screen.getByText(copy.tour.tutorial)).toBeInTheDocument();
    // Without Next it waits on the first question.
    await waitFor(() => expect(document.querySelector('[data-cartograph-field="/spec/summary/about"]')).not.toHaveValue(""));
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector("[data-step]")?.getAttribute("data-step")).toBe("about");
    expect(navigate).not.toHaveBeenCalled();
    // Each Next shows the next question; the last opens a project.
    for (let i = 0; i < 6 && !navigate.mock.calls.length; i++) {
      await waitFor(() => expect(taken).not.toBeNull());
      act(() => void taken?.());
      await new Promise((r) => setTimeout(r, 60));
    }
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/projects/$id/initiation/goals", params: { id: "depot-checks" } }), { timeout: 4000 });
    expect(screen.getByLabelText(copy.start.nameLabel)).toHaveValue(copy.tour.sample.name);
    expect(saveWorking).not.toHaveBeenCalled();
    expect(saveVersion).not.toHaveBeenCalled();
  });
});
