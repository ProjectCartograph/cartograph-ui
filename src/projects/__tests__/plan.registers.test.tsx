/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { RaciEditor } from "../sections/PlanRegisters";
import { ApprovalSection } from "../sections/ApprovalSection";
import { MilestonesSection } from "../sections/MilestonesSection";
import { EventPicker } from "../TimingField";
import type { ProjectSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

let spec: ProjectSpec;
function Spy() {
  spec = useProjectStore().spec;
  return null;
}

function mount(s: object, node: ReactNode) {
  const project = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Depot checks" }, spec: { team: "t1", summary: {}, ...s } };
  render(
    <ClientProvider client={fakeClient({ get: async () => ({ version: { number: 0 }, manifest: project, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined, schedule: async () => [] as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProjectStoreProvider id="p1">
          {node}
          <Spy />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

const resources = [
  { id: "sponsor", role: "sponsor", resource: "ps" },
  { id: "lead", role: "manager", resource: "head" },
];

describe("the plan's registers", () => {
  // A cell steps through R, A, C and I; a row has one accountable role, so
  // naming a second moves it (RACI, engine TAXONOMY.md D50).
  it("keeps one accountable role per row", async () => {
    mount({ resources, responsibilities: [{ id: "r1", item: "Approve the baseline" }] }, <RaciEditor />);
    const row = (await screen.findByDisplayValue("Approve the baseline")).closest("tr") as HTMLElement;
    const cells = within(row).getAllByRole("button").filter((b) => b.hasAttribute("data-raci-cell"));
    fireEvent.click(cells[0]);
    fireEvent.click(cells[0]);
    expect(spec.responsibilities?.[0].accountable).toEqual({ local: "resources", id: "sponsor" });
    fireEvent.click(cells[1]);
    fireEvent.click(cells[1]);
    expect(spec.responsibilities?.[0].accountable).toEqual({ local: "resources", id: "lead" });
    expect(spec.responsibilities?.[0].responsible).toBeUndefined();
  });

  // Signing is an event on the line, kept in the record (TAXONOMY.md D52).
  it("records a signature as an event", async () => {
    mount({ resources, signOffs: [{ id: "s1", stage: "definition", label: "Approved by", role: { local: "resources", id: "sponsor" } }] }, <ApprovalSection />);
    fireEvent.click(await screen.findByRole("button", { name: /^Sign for/ }));
    expect(spec.events?.[0]).toMatchObject({ on: { local: "signOffs", id: "s1" }, happened: "signed", decision: "approve" });
  });

  // Each phase becomes a milestone in its last month.
  it("turns phases into milestones at their ends", async () => {
    mount({ timeline: { start: "2025-09", phases: [{ name: "Pilot", months: 3 }, { name: "Rollout", months: 6 }] } }, <MilestonesSection />);
    fireEvent.click(await screen.findByRole("button", { name: copy.projects.milestones.fromPhasesHint }));
    expect(spec.milestones?.map((m) => m.timing.date)).toEqual(["2025-11", "2026-05"]);
  });

  // A milestone may wait on a milestone of a project linked by components
  // (engine TAXONOMY.md D47): the picker offers theirs, and keeps the
  // choice as the project and the item.
  it("offers the milestones of linked projects", async () => {
    const survey = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "survey", name: "Survey" }, spec: { milestones: [{ id: "s1", name: "Instruments approved", timing: { form: "date", date: "2026-08" } }] } };
    const own = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Survey app" }, spec: { team: "t1", summary: {} } };
    const onChange = vi.fn();
    render(
      <ClientProvider
        client={fakeClient({
          get: async (_kind: string, id: string) => ({ version: { number: 0 }, manifest: id === "survey" ? survey : own, yaml: "" }) as never,
          list: async () => [] as never,
          saveWorking: async () => undefined,
          components: async () =>
            ({
              nodes: [{ kind: "Project", id: "p1", name: "Survey app" }, { kind: "Project", id: "survey", name: "Survey" }],
              edges: [{ from: { kind: "Project", id: "survey" }, to: { kind: "Project", id: "p1" } }],
              loops: [],
              criticalPath: [],
            }) as never,
        })}
      >
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p1">
            <EventPicker value={{ on: { kind: "Project", id: "survey" }, item: "s1" }} onChange={onChange} />
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText("Instruments approved")).toBeInTheDocument();
  });
});
