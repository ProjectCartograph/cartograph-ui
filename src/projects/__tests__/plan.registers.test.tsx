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
});
