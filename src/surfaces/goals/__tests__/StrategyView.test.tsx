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

  it("shows the purpose, and the tree as names with a quiet mark on what is unfinished", async () => {
    renderView({ goalLevels: [], projectLevelName: "Project", operator: "x", purpose: { vision: "Power in every home", source: "Plan, section 2" } });
    expect(await screen.findByText("Power in every home")).toBeTruthy();
    // No mission stated: said so, not left blank.
    expect(screen.getByText("Not set")).toBeTruthy();
    expect(screen.getByText("Reliable service")).toBeTruthy();
    expect(screen.getByText("Fewer faults")).toBeTruthy();
    expect(screen.getByText("Faults caught at intake")).toBeTruthy();
    // The aim and the reason are not on the page until a goal is opened.
    expect(screen.queryByText("Customers leave after a second outage.")).toBeNull();
    // No counts and no letters on the tree: one mark, saying what is missing.
    expect(screen.queryByLabelText("Gaps: 1")).toBeNull();
    expect(screen.getAllByRole("img", { name: /no indicator measures it/ })).toHaveLength(1);
  });

  it("previews one item after another beside the tree on a wide screen", async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
    try {
      renderView({ goalLevels: [], projectLevelName: "Project", operator: "x" });
      const pane = await screen.findByRole("complementary", { name: "Preview" });
      fireEvent.click(screen.getByRole("button", { name: /Reliable service/ }));
      expect(within(pane).getByText("Keep every customer supplied")).toBeTruthy();
      // One click to the next: no close in between.
      fireEvent.click(screen.getByRole("button", { name: /Faults caught at intake/ }));
      expect(within(pane).getByRole("list", { name: "Gaps" })).toBeTruthy();
      expect(within(pane).getByLabelText("Work: 2")).toBeTruthy();
      expect(within(pane).queryByText("Keep every customer supplied")).toBeNull();
    } finally {
      window.matchMedia = matchMedia;
    }
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

  it("states the purpose at the top of the strategy, as its own manifest", async () => {
    const saveVersion = vi.fn(async () => ({ number: 1 }) as never);
    const client = fakeClient({
      goalTree: async () => tree,
      settings: async () => ({ goalLevels: [], projectLevelName: "Project", operator: "x" }),
      get: async () => Promise.reject(new Error("not found")),
      session: async () => ({ actor: "ren", canWrite: true }) as never,
      saveVersion,
      list: async () => [],
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <StrategyView />
        </QueryClientProvider>
      </ClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "State the purpose" }));
    fireEvent.change(screen.getByLabelText("Vision"), { target: { value: "Every member earns a fair living" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saveVersion).toHaveBeenCalled());
    const [kind, id, doc] = saveVersion.mock.calls[0] as unknown as [string, string, { kind: string; spec: { vision: string } }];
    expect([kind, id, doc.kind, doc.spec.vision]).toEqual(["Purpose", "default", "Purpose", "Every member earns a fair living"]);
  });
});
