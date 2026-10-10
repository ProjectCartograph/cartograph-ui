/// <reference types="@testing-library/jest-dom" />
// The triple constraint (engine TAXONOMY.md D60): stances set up front,
// risks raised where they bear, and a risk row that places itself.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { ConstraintStances } from "../constraints/Stances";
import { SideRisks } from "../constraints/RisksHere";
import { AffectsEditor } from "../constraints/AffectsEditor";
import { bearsOnOf, placeOn, risksOn, takeOff } from "../constraints/triangle";
import type { ProjectSpec, Risk } from "../types";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const tc = copy.projects.triangle;

let spec: ProjectSpec;
function Spy() {
  const current = useProjectStore().spec;
  useEffect(() => {
    spec = current;
  });
  return null;
}

function mount(s: object, node: ReactNode) {
  const project = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Depot checks" }, spec: { team: "t1", summary: {}, ...s } };
  render(
    <ClientProvider client={fakeClient({ get: async () => ({ version: { number: 0 }, manifest: project, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProjectStoreProvider id="p1">
          {node}
          <Spy />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("the triangle's helpers", () => {
  const risks: Risk[] = [
    { id: "board", description: "Late board", type: "risk", affects: [{ constraint: "schedule", impact: "high", on: "pilot" }] },
    { id: "forms", description: "Forms run short", type: "risk", affects: [{ constraint: "cost" }] },
  ];
  it("finds the risks on a side, and on an item", () => {
    expect(risksOn(risks, "schedule").map((r) => r.risk.id)).toEqual(["board"]);
    expect(risksOn(risks, "schedule", ["rollout"])).toEqual([]);
    expect(risksOn(risks, "scope")).toEqual([]);
  });
  it("places a risk on a side once, and takes it off", () => {
    const placed = placeOn(placeOn(risks[1], "schedule", { impact: "low" }), "schedule", { on: "pilot" });
    expect(placed.affects).toEqual([{ constraint: "cost" }, { constraint: "schedule", impact: "low", on: "pilot" }]);
    expect(takeOff(takeOff(placed, "schedule"), "cost").affects).toBeUndefined();
  });
  it("reads what each side can bear on", () => {
    const b = bearsOnOf({ deliverables: [{ id: "app", name: "App" }], milestones: [{ id: "pilot", name: "Pilot" }], costs: [{ id: "c1", category: "staff" }] } as never);
    expect(b).toEqual({ scope: [{ id: "app", name: "App" }], schedule: [{ id: "pilot", name: "Pilot" }], cost: [{ id: "c1", name: "staff" }] });
  });
});

describe("the stances", () => {
  it("are set up front as tiles, and warn when all three are held", async () => {
    mount({ constraints: { scope: "hold", schedule: "hold" } }, <ConstraintStances />);
    await screen.findByText(tc.stancesHeading);
    const cost = document.querySelector('[data-cartograph-field="/spec/constraints/cost"]');
    expect(cost).toHaveAttribute("aria-label", tc.stanceFor(tc.sides.cost));
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getAllByRole("radio", { name: tc.stanceTitle.hold })[2]);
    expect(spec.constraints).toEqual({ scope: "hold", schedule: "hold", cost: "hold" });
    expect(screen.getByRole("status")).toHaveTextContent(tc.allHeld);
  });
});

describe("risks where they bear", () => {
  it("shows the schedule's risks beside the milestones, and adds one there", async () => {
    mount(
      {
        milestones: [{ id: "pilot", name: "Pilot at two depots" }],
        constraints: { schedule: "hold" },
        risks: [{ id: "board", description: "The board meets late", type: "risk", affects: [{ constraint: "schedule", impact: "high", on: "pilot" }] }],
      },
      <SideRisks side="schedule" />,
    );
    expect(await screen.findByText("The board meets late")).toBeInTheDocument();
    expect(screen.getByText(tc.on("Pilot at two depots"))).toBeInTheDocument();
    expect(screen.getByText(tc.held)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: tc.hereAdd(tc.sides.schedule) }));
    fireEvent.change(screen.getByRole("textbox", { name: tc.hereDescription }), { target: { value: "Rain closes the roads" } });
    fireEvent.click(screen.getByRole("button", { name: tc.hereSave }));
    const added = spec.risks?.find((r) => r.description === "Rain closes the roads");
    expect(added?.type).toBe("risk");
    expect(added?.affects).toEqual([{ constraint: "schedule" }]);
    expect(added?.id).toMatch(/^r-/);
  });
});

describe("a risk row", () => {
  it("places itself on a side and says what its response spends", () => {
    let risk: Risk = { id: "board", description: "Late board", type: "risk" };
    const { rerender } = render(<AffectsEditor risk={risk} index={0} items={{}} onChange={(r) => (risk = r)} />);
    fireEvent.click(screen.getByRole("button", { name: tc.affectsAdd(tc.sides.schedule) }));
    expect(risk.affects).toEqual([{ constraint: "schedule" }]);
    rerender(<AffectsEditor risk={risk} index={0} items={{}} onChange={(r) => (risk = r)} />);
    expect(screen.getByRole("button", { name: tc.affectsRemove(tc.sides.schedule) })).toHaveAttribute("data-cartograph-field", "/spec/risks/{board}/affects");
    expect(screen.getByRole("combobox", { name: tc.spendsLabel })).toHaveAttribute("data-cartograph-field", "/spec/risks/{board}/spends");
  });
});
