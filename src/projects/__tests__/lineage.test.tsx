/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { LineageGraph } from "../sections/LineageGraph";

const lc = copy.projects.data.lineage;

// The data is drawn as the engine places it, left to right as it flows,
// and a source or an output is added from the graph itself.
describe("the data lineage", () => {
  it("draws the engine's lineage and adds from either side", async () => {
    const lineage = vi.fn(async () => ({
      nodes: [
        { kind: "DataSource", id: "register", name: "Member register", role: "source" as const, x: 1, y: 0 },
        { kind: "Project", id: "p1", name: "Depot checks", role: "project" as const, x: 2, y: 0 },
        { kind: "DataSource", id: "tool", name: "Check tool", role: "output" as const, x: 3, y: 0 },
        { kind: "KPI", id: "pass-rate", name: "Pass rate", role: "downstream" as const, x: 4, y: 0 },
      ],
      edges: [
        { from: { kind: "DataSource", id: "register" }, to: { kind: "Project", id: "p1" } },
        { from: { kind: "Project", id: "p1" }, to: { kind: "DataSource", id: "tool" } },
        { from: { kind: "DataSource", id: "tool" }, to: { kind: "KPI", id: "pass-rate" } },
      ],
    }));
    const onAddUse = vi.fn();
    const onAddOutput = vi.fn();
    const { container } = render(
      <ClientProvider client={fakeClient({ lineage })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <LineageGraph project="p1" name="Depot checks" uses={["register"]} produces={["tool"]} onAddUse={onAddUse} onAddOutput={onAddOutput} />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText("Pass rate")).toBeInTheDocument();
    expect(lineage).toHaveBeenCalledWith("p1", "Depot checks", ["register"], ["tool"]);
    expect(container.querySelectorAll("path[marker-end]")).toHaveLength(3);
    expect(container.querySelector('[data-lineage="Project/p1"]')?.getAttribute("data-role")).toBe("project");
    fireEvent.click(screen.getByRole("button", { name: lc.addUse }));
    fireEvent.click(screen.getByRole("button", { name: lc.addOutput }));
    expect(onAddUse).toHaveBeenCalledOnce();
    expect(onAddOutput).toHaveBeenCalledOnce();
  });
});
