/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { RiskPrompt } from "../constraints/RiskPrompt";
import { ScopeSection } from "../sections/ScopeSection";
import type { ProjectSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> }));

const tc = copy.projects.triangle;
let spec: ProjectSpec;
function Spy() {
  spec = useProjectStore().spec;
  return null;
}

function mount(start: ProjectSpec, node: ReactNode) {
  const manifest = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Depot checks" }, spec: start };
  render(
    <ClientProvider client={fakeClient({ get: async () => ({ version: { number: 0 }, manifest, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProjectStoreProvider id="p1">
          <Spy />
          {node}
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// A risk is raised beside what it would move, with that item's own
// question, and placed there (#59; engine TAXONOMY.md D60, D62).
describe("a risk raised where it bears", () => {
  it("places a missed milestone's risk on the milestone, on schedule", async () => {
    const user = userEvent.setup();
    mount({ milestones: [{ id: "m1", name: "Pilot starts", timing: { form: "date", date: "2026-10" } }] } as ProjectSpec, <RiskPrompt side="schedule" on="m1" question={tc.askMissed} short={tc.shortMissed} />);
    await user.click(await screen.findByRole("button", { name: tc.askMissed }));
    await user.type(screen.getByRole("textbox", { name: tc.askMissed }), "The pilot slips a season{Enter}");
    expect(spec.risks?.[0]).toMatchObject({ description: "The pilot slips a season", type: "risk", affects: [{ constraint: "schedule", on: "m1" }] });
    expect(screen.getByRole("button", { name: tc.promptCount(1) })).toBeInTheDocument();
  });

  it("carries a scope line's risks along when the line is edited", async () => {
    const user = userEvent.setup();
    mount(
      { summary: { scopeIn: ["Checking every delivery"] }, risks: [{ id: "r1", description: "Fruit gets checked too", type: "risk", scopeLine: "Checking every delivery" }] } as ProjectSpec,
      <ScopeSection />,
    );
    const line = await screen.findByDisplayValue("Checking every delivery");
    await user.type(line, " at intake");
    expect(spec.summary?.scopeIn?.[0]).toBe("Checking every delivery at intake");
    expect(spec.risks?.[0].scopeLine).toBe("Checking every delivery at intake");
  });
});
