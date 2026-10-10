/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Waits } from "@/client/port";
import { copy } from "@/copy";
import type { ProjectSpec } from "../../types";
import { ProjectMap } from "../ProjectMap";
import { timingWords, waitsMap } from "../waits";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const mc = copy.projectMap;

// The engine's graph of waits for a pilot: it starts, its review two
// months later, and a KPI's target set at the review (engine TAXONOMY.md
// D47, D48). Laid out by the engine; the map only draws it.
const waits: Waits = {
  nodes: [
    { kind: "milestone", record: { kind: "Project", id: "p1" }, item: "milestones/start", name: "Pilot starts", timing: { form: "date", date: "2026-10" }, month: "2026-10", critical: true, conflict: false, late: false, unplaced: false, x: 0, y: 0 },
    {
      kind: "milestone", record: { kind: "Project", id: "p1" }, item: "milestones/review", name: "Pilot review", follows: "Pilot starts",
      timing: { form: "after", event: { on: { local: "milestones", id: "start" } }, lagMonths: 2, risks: ["r1"] }, month: "2026-12",
      risks: ["Graders are not trained in time"], critical: true, conflict: false, late: false, unplaced: false, x: 0, y: 180,
    },
    { kind: "target", record: { kind: "KPI", id: "graded" }, name: "Crates graded", follows: "Pilot review", timing: { form: "when", expectedBy: "2027-02" }, month: "2027-02", critical: false, conflict: true, late: false, unplaced: false, x: 120, y: 360 },
  ],
  edges: [
    { from: 0, to: 1 },
    { from: 1, to: 2 },
  ],
};

describe("the words for a timing", () => {
  it("says each form as a person would", () => {
    expect(timingWords(waits.nodes[1])).toBe(mc.waits.after(2, 0, "Pilot starts"));
    expect(timingWords(waits.nodes[2])).toMatch(/^Set when Pilot review happens, expected by /);
    expect(waitsMap(waits).lines).toHaveLength(3);
    expect(waitsMap(waits).edges.map((e) => e.tone)).toEqual(["critical", "plain"]);
  });
});

describe("the waits view of the project map", () => {
  it("draws what the engine laid out, and joins two milestones by a drag", async () => {
    const spec = {
      summary: {},
      milestones: [
        { id: "start", name: "Pilot starts", timing: { form: "date", date: "2026-10" } },
        { id: "review", name: "Pilot review", timing: { form: "after", event: { on: { local: "milestones", id: "start" } }, lagMonths: 2 } },
      ],
    } as unknown as ProjectSpec;
    let next = spec;
    const updateSpec = vi.fn((fn: (s: ProjectSpec) => ProjectSpec) => {
      next = fn(next);
    });
    render(
      <ClientProvider
        client={fakeClient({
          graph: async () => ({ nodes: [], edges: [] }) as never,
          components: async () => ({ nodes: [], edges: [], loops: [], criticalPath: [], criticalMonths: 0 }) as never,
          waits: async () => waits,
        })}
      >
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectMap id="p1" spec={spec} updateSpec={updateSpec} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: mc.waitsLens }));
    expect(await screen.findByText(mc.waits.after(2, 0, "Pilot starts"))).toBeInTheDocument();
    const review = document.querySelector('[data-map-node="Project/p1#milestones/review"]') as HTMLElement;
    expect(review.querySelector('[data-mark="critical"]')).not.toBeNull();
    expect(review.querySelector('[data-mark="risk"]')).toHaveAccessibleName(mc.waits.movedBy("Graders are not trained in time"));
    expect(document.querySelector('[data-map-node="KPI/graded#target-2"] [data-mark="conflict"]')).not.toBeNull();

    // The review already waits on the start in the engine's graph; drawn
    // the other way, the start now waits on the review.
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(mc.connect) }));
    const start = document.querySelector('[data-map-node="Project/p1#milestones/start"]') as HTMLElement;
    document.elementFromPoint = () => start;
    fireEvent.pointerDown(review, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(review.parentElement!, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(review.parentElement!, { clientX: 20, clientY: 20, pointerId: 1 });
    expect(updateSpec).toHaveBeenCalled();
    expect(next.milestones?.find((m) => m.id === "start")?.waitsOn).toEqual([{ on: { local: "milestones", id: "review" } }]);
  });
});
