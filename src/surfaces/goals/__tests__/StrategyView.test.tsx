import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Settings } from "@/client/port";
import { StrategyView } from "../StrategyView";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="#" className={className}>
      {children}
    </a>
  ),
}));

const none = { projects: 0, programmes: 0, operations: 0, kpis: 0 };
const tree = {
  levels: ["Goal", "Objective", "Outcome"],
  nodes: [
    {
      id: "g1", name: "Reliable service", level: "goal", objective: "Keep every customer supplied",
      why: "Customers leave after a second outage.", keyResults: 0, aligned: none,
      children: [
        {
          id: "o1", name: "Fewer faults", level: "objective", parent: "g1", keyResults: 0, aligned: none,
          children: [
            {
              id: "c1", name: "Faults caught at intake", level: "outcome", parent: "o1", keyResults: 0,
              aligned: { ...none, projects: 2 },
              contributesTo: [{ goal: "o2", because: "Fewer returns free the van" }],
              gaps: [
                { id: "gap1", name: "Late fault detection", current: "One fault in five found at intake" },
              ],
              children: [],
            },
          ],
        },
        { id: "o2", name: "Faster delivery", level: "objective", parent: "g1", keyResults: 0, aligned: none, children: [] },
      ],
    },
  ],
};

function renderView(settings: Settings) {
  const client = fakeClient({
    goalTree: async () => tree,
    settings: async () => settings,
    list: async () => [],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <StrategyView />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("StrategyView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the purpose on one line each and the tree as names and marks", async () => {
    renderView({ goalLevels: [], projectLevelName: "Project", operator: "x", purpose: { vision: "Power in every home", source: "Plan, section 2" } });
    expect(await screen.findByText("Power in every home")).toBeTruthy();
    // No mission stated: said so, not left blank.
    expect(screen.getByText("Not set")).toBeTruthy();
    expect(screen.getByText("Reliable service")).toBeTruthy();
    expect(screen.getByText("Fewer faults")).toBeTruthy();
    expect(screen.getByText("Faults caught at intake")).toBeTruthy();
    // The aim and the reason are not on the page until a goal is opened.
    expect(screen.queryByText("Customers leave after a second outage.")).toBeNull();
    expect(screen.getByLabelText("Gaps: 1")).toBeTruthy();
    expect(screen.getByLabelText("Work: 2")).toBeTruthy();
  });

  it("opens an outcome's gaps, from current to desired, and what else it leads to", async () => {
    renderView({ goalLevels: [], projectLevelName: "Project", operator: "x" });
    fireEvent.click(await screen.findByRole("button", { name: /Faults caught at intake/ }));
    const gaps = await screen.findByRole("list", { name: "Gaps" });
    expect(within(gaps).getByText("Late fault detection")).toBeTruthy();
    expect(within(gaps).getByText("One fault in five found at intake")).toBeTruthy();
    expect(within(gaps).getByText("Desired state not set")).toBeTruthy();
    expect(screen.getByText(/Fewer returns free the van/)).toBeTruthy();
  });

  it("opens a goal's aim and rationale", async () => {
    renderView({ goalLevels: [], projectLevelName: "Project", operator: "x" });
    fireEvent.click(await screen.findByRole("button", { name: /Reliable service/ }));
    expect(await screen.findByText("Keep every customer supplied")).toBeTruthy();
    expect(screen.getByText("Customers leave after a second outage.")).toBeTruthy();
  });
});
