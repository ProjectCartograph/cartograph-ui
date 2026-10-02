/// <reference types="@testing-library/jest-dom" />
// The workspace graph as the engine places and measures it: the view
// draws the engine's positions, lights what a node touches and dims the
// rest, and lights a chosen node's connections to the depth the engine
// measured.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Graph } from "@/client/port";
import { copy } from "@/copy";
import { GraphView } from "../GraphView";
import { restHere, springs, step, type Body } from "../motion";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params }: { children?: React.ReactNode; to: string; params?: Record<string, string> }) => (
    <a href={Object.entries(params ?? {}).reduce((p, [k, v]) => p.replace(`$${k}`, v), to)}>{children}</a>
  ),
}));

const gc = copy.graph;

const graph: Graph = {
  nodes: [
    { kind: "Goal", id: "g1", name: "Members are paid fairly", level: "goal", x: 0, y: -200 },
    { kind: "Goal", id: "o1", name: "Fruit arrives sound", level: "outcome", x: 0, y: -100 },
    { kind: "KPI", id: "k1", name: "Sound on arrival", x: 80, y: -60 },
    { kind: "Project", id: "p1", name: "Cool the depots", x: -60, y: 0 },
    { kind: "Team", id: "t1", name: "Depot network", x: -120, y: 80 },
    { kind: "Segment", id: "s1", name: "Northern region", x: 200, y: 200 },
  ],
  edges: [
    { from: { kind: "Goal", id: "o1" }, to: { kind: "Goal", id: "g1" } },
    { from: { kind: "KPI", id: "k1" }, to: { kind: "Goal", id: "o1" } },
    { from: { kind: "Project", id: "p1" }, to: { kind: "Goal", id: "o1" } },
    { from: { kind: "Project", id: "p1" }, to: { kind: "Team", id: "t1" } },
  ],
};

// The engine's distances from the KPI.
const fromKPI: Graph = {
  ...graph,
  nodes: graph.nodes.map((n) => ({ ...n, distance: ({ "KPI/k1": 0, "Goal/o1": 1, "Goal/g1": 2, "Project/p1": 2, "Team/t1": 3 } as Record<string, number>)[`${n.kind}/${n.id}`] })),
};

function mount(focus?: string) {
  const asked: (string | undefined)[] = [];
  const client = fakeClient({
    graph: async (f?: string) => {
      asked.push(f);
      return f === "KPI/k1" ? fromKPI : graph;
    },
  });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <GraphView graph={graph} focus={focus} />
      </QueryClientProvider>
    </ClientProvider>,
  );
  return asked;
}

const node = (key: string) => document.querySelector(`[data-node="${key}"]`)!;

describe("the graph", () => {
  it("draws each node where the engine placed it, at once for anyone who asked for less motion", () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
    try {
      mount();
      expect(node("KPI/k1")).toHaveAttribute("transform", "translate(80,-60)");
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it("lights what a node touches and dims the rest", () => {
    mount();
    fireEvent.pointerEnter(node("KPI/k1"));
    expect(node("Goal/o1")).not.toHaveAttribute("data-dim");
    expect(node("Project/p1")).toHaveAttribute("data-dim");
    expect(document.querySelectorAll("[data-lit]")).toHaveLength(1);
    fireEvent.pointerLeave(node("KPI/k1"));
    expect(node("Project/p1")).not.toHaveAttribute("data-dim");
  });

  it("lights a chosen node's connections to the depth the engine measured", async () => {
    const asked = mount("KPI/k1");
    expect(asked).toContain("KPI/k1");
    const card = screen.getByRole("complementary", { name: "Sound on arrival" });
    expect(within(card).getByRole("link", { name: gc.open })).toHaveAttribute("href", "/kpis/k1");
    // Two steps: the project serving the same outcome is lit; the team
    // three steps away and the segment joined to nothing are not.
    await waitFor(() => expect(node("Project/p1")).not.toHaveAttribute("data-dim"));
    expect(node("Team/t1")).toHaveAttribute("data-dim");
    expect(node("Segment/s1")).toHaveAttribute("data-dim");
    fireEvent.click(within(card).getByRole("radio", { name: gc.depths.all }));
    await waitFor(() => expect(node("Team/t1")).not.toHaveAttribute("data-dim"));
    expect(node("Segment/s1")).toHaveAttribute("data-dim");
  });

  it("finds by name, and hides a kind", () => {
    mount();
    fireEvent.change(screen.getByRole("textbox", { name: gc.search }), { target: { value: "cool" } });
    fireEvent.click(within(screen.getByRole("list", { name: gc.search })).getByRole("button", { name: /Cool the depots/ }));
    expect(screen.getByRole("complementary", { name: "Cool the depots" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: gc.hideKind(gc.kind.Team) }));
    expect(document.querySelector('[data-node="Team/t1"]')).toBeNull();
  });
});

describe("the motion", () => {
  const home = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 400, y: 300 }];
  const links = springs(home, [{ s: 0, t: 1 }]);
  const settle = (bodies: Body[], n = 600) => {
    for (let i = 0; i < n; i++) step(bodies, home, links);
  };

  it("settles into the engine's layout from wherever it starts", () => {
    const bodies = home.map((h) => ({ x: h.x * 0.25, y: h.y * 0.25, vx: 0, vy: 0 }));
    settle(bodies);
    bodies.forEach((b, i) => expect(Math.hypot(b.x - home[i].x, b.y - home[i].y)).toBeLessThan(1));
  });

  it("keeps a dropped node where it was put, and what it pulled where it settled", () => {
    const rest = home.map((h) => ({ ...h }));
    const ties = springs(home, [{ s: 0, t: 1 }]);
    const bodies: Body[] = home.map((h) => ({ x: h.x, y: h.y, vx: 0, vy: 0 }));
    bodies[0] = { x: -200, y: 50, vx: 0, vy: 0, pinned: true };
    rest[0] = { x: -200, y: 50 };
    for (let i = 0; i < 600; i++) step(bodies, rest, ties);
    restHere(bodies, rest, ties);
    const settled = bodies.map((b) => ({ x: b.x, y: b.y }));
    // Nothing creeps once it is still.
    let moving = 0;
    for (let i = 0; i < 200; i++) moving += step(bodies, rest, ties);
    expect(moving).toBe(0);
    expect(bodies[0]).toMatchObject({ x: -200, y: 50 });
    bodies.forEach((b, i) => expect(Math.hypot(b.x - settled[i].x, b.y - settled[i].y)).toBeLessThan(0.01));
    expect(bodies[1].x).toBeLessThan(0);
  });

  it("pulls what is linked along with a dragged node, and leaves the rest", () => {
    const bodies: Body[] = home.map((h) => ({ x: h.x, y: h.y, vx: 0, vy: 0 }));
    bodies[0] = { x: -200, y: 0, vx: 0, vy: 0, held: true };
    for (let i = 0; i < 20; i++) step(bodies, home, links);
    expect(bodies[1].x).toBeLessThan(80);
    expect(Math.hypot(bodies[2].x - 400, bodies[2].y - 300)).toBeLessThan(1);
    bodies[0].held = false;
    settle(bodies);
    expect(Math.hypot(bodies[0].x, bodies[0].y)).toBeLessThan(1);
  });
});

// The engine stacks the graph in bands, top-down in the order of work
// (TAXONOMY.md D28); the view names each band and points every edge at
// what it names.
describe("the graph as a directed acyclic graph", () => {
  const layered: Graph = {
    nodes: [
      { kind: "Team", id: "t1", name: "Depot network", layer: 0, x: 0, y: 0 },
      { kind: "Goal", id: "g1", name: "Members are paid fairly", level: "goal", stage: "goal", layer: 2, x: 0, y: 180 },
      { kind: "Goal", id: "o1", name: "Fruit arrives sound", level: "outcome", stage: "outcome", layer: 4, x: 0, y: 360 },
    ],
    edges: [
      { from: { kind: "Goal", id: "o1" }, to: { kind: "Goal", id: "g1" } },
      { from: { kind: "Goal", id: "g1" }, to: { kind: "Team", id: "t1" } },
    ],
  };
  function draw(g: Graph) {
    const { container } = render(
      <ClientProvider client={fakeClient({ graph: async () => g })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <GraphView graph={g} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    return container;
  }

  it("names each band, top-down, and arrows every edge", () => {
    const container = draw(layered);
    const bands = [...container.querySelectorAll("[data-band]")].map((b) => b.textContent);
    expect(bands).toEqual([gc.registers, copy.newWork.stage.goal, copy.newWork.stage.outcome]);
    const edges = container.querySelectorAll('[data-slot="graph-edges"] line');
    expect(edges).toHaveLength(2);
    for (const e of edges) expect(e.getAttribute("marker-end")).toBe("url(#cartograph-graph-arrow)");
  });

  it("names no band where the layout does not stack them", () => {
    expect(draw(graph).querySelectorAll("[data-band]")).toHaveLength(0);
  });
});
