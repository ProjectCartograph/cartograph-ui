/// <reference types="@testing-library/jest-dom" />
// The risks step as the overview of the triple constraint (engine
// TAXONOMY.md D60): drawn from what the engine weighs, each mark in words.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { TripleConstraint } from "@/client/port";
import { copy } from "@/copy";
import { ProjectStoreProvider } from "../store";
import { TriangleOverview } from "../constraints/Overview";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => <a data-to={to}>{children}</a>,
}));

const tc = copy.projects.triangle;

const weighed: TripleConstraint = {
  mostConstrained: "schedule",
  unplaced: ["rain"],
  sides: [
    { constraint: "scope", stance: "adjust", exposure: 0, share: 0, risks: [], unweighed: 0, unanswered: 0 },
    {
      constraint: "schedule",
      stance: "hold",
      exposure: 6,
      share: 0.667,
      risks: [{ id: "board", type: "risk", impact: "high", likelihood: "medium", weight: 6, on: "pilot" }],
      unweighed: 0,
      unanswered: 1,
    },
    { constraint: "cost", stance: "concede", exposure: 3, share: 0.333, risks: [{ id: "forms", type: "risk", impact: "low", weight: 3 }], unweighed: 0, unanswered: 0 },
  ],
};

function mount() {
  const spec = {
    team: "t1",
    summary: {},
    milestones: [{ id: "pilot", name: "Pilot at two depots" }],
    constraints: { scope: "adjust", schedule: "hold", cost: "concede" },
    risks: [
      { id: "board", description: "The board meets late", type: "risk" },
      { id: "forms", description: "Forms run short", type: "risk" },
      { id: "rain", description: "Rain closes the roads", type: "risk" },
    ],
  };
  const project = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Depot checks" }, spec };
  const constraints = vi.fn(async () => weighed);
  render(
    <ClientProvider client={fakeClient({ get: async () => ({ version: { number: 0 }, manifest: project, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined, constraints })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProjectStoreProvider id="p1">
          <TriangleOverview />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
  return constraints;
}

describe("the triangle overview", () => {
  it("draws what the engine weighs, says it in words, and links each risk to where it bears", async () => {
    const constraints = mount();
    expect(await screen.findByRole("img", { name: tc.overviewLabel })).toBeInTheDocument();
    expect(constraints).toHaveBeenCalledWith("p1");
    // The most constrained side is said, not only ringed.
    expect(screen.getAllByText(tc.mostConstrained).length).toBeGreaterThan(0);
    expect(screen.getByText(tc.heldAndMost)).toBeInTheDocument();
    expect(screen.getByText(tc.weighted(6, 0.667), { exact: false })).toBeInTheDocument();
    expect(screen.getByText(tc.on("Pilot at two depots"))).toBeInTheDocument();
    expect(screen.getByText(tc.unanswered(1))).toBeInTheDocument();
    const toSchedule = screen.getByText(tc.goTo(copy.projects.sections.timeline));
    expect(toSchedule).toHaveAttribute("data-to", "/projects/$id/initiation/timeline");
    // A risk on no side is listed apart, to be placed.
    expect(screen.getByText(tc.unplacedHeading)).toBeInTheDocument();
    expect(screen.getByText("Rain closes the roads")).toBeInTheDocument();
  });
});
