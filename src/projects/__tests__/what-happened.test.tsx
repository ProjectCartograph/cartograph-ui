/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Happened, WaitsNode } from "@/client/port";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import type { ProjectSpec } from "../types";
import { WhatHappened } from "../WhatHappened";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const wh = copy.projects.whatHappened;
let spec: ProjectSpec;
function Spy() {
  spec = useProjectStore().spec;
  return null;
}

const found: Happened = {
  available: true,
  matches: [{ item: "risks/r-models", kind: "risk", name: "The food models cost more than budgeted", happens: ["occurred"], likelihood: 0.9 }],
};
const reach: WaitsNode[] = [
  { kind: "deliverable", record: { kind: "Project", id: "p1" }, item: "deliverables/survey", name: "Depot survey", month: "2027-01", critical: false, conflict: false, late: false, unplaced: false, x: 0, y: 0 },
  { kind: "target", record: { kind: "KPI", id: "graded" }, name: "Crates graded", month: "2027-03", critical: false, conflict: false, late: false, unplaced: false, x: 0, y: 0 },
];

// Something happened, in the person's words: matched to the item, its
// reach shown, and the event recorded with what follows from it, each
// follow-on naming it as its cause (engine TAXONOMY.md D59).
describe("something happened", () => {
  it("records the event and what follows from it, in one edit", async () => {
    const project = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Depot checks" }, spec: { team: "t1", summary: {} } };
    const whatHappened = vi.fn(async () => found);
    const affects = vi.fn(async () => reach);
    render(
      <ClientProvider client={fakeClient({ get: async () => ({ version: { number: 0 }, manifest: project, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined, whatHappened, affects })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p1">
            <WhatHappened />
            <Spy />
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    fireEvent.change(await screen.findByLabelText(wh.textLabel), { target: { value: "The food models came in over budget" } });
    fireEvent.click(screen.getByRole("button", { name: wh.find }));
    fireEvent.click(await screen.findByRole("radio", { name: /The food models cost more than budgeted/ }));
    expect(affects).toHaveBeenCalledWith("p1", "risks/r-models");
    const list = await screen.findByRole("list", { name: wh.reachLabel });
    expect(within(list).getByText(wh.changeThere)).toBeInTheDocument();
    // The survey slips because the risk occurred.
    fireEvent.click(within(list).getByRole("combobox", { name: wh.followLabel("Depot survey") }));
    fireEvent.click(await screen.findByRole("option", { name: copy.projects.approval.happenedWords.slipped }));
    fireEvent.change(screen.getByLabelText(wh.dateLabel), { target: { value: "2026-11-02" } });
    fireEvent.click(screen.getByRole("button", { name: wh.record }));
    await waitFor(() => expect(spec.events).toHaveLength(2));
    expect(spec.events?.[0]).toMatchObject({ on: { local: "risks", id: "r-models" }, happened: "occurred", date: "2026-11-02", note: "The food models came in over budget" });
    expect(spec.events?.[1]).toMatchObject({ on: { local: "deliverables", id: "survey" }, happened: "slipped", cause: spec.events?.[0].id });
  });
});
