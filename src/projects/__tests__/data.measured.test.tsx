/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider, useProjectStore } from "../store";
import { DataSection } from "../sections/DataSection";
import type { ProjectSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: ReactNode }) => <span>{children}</span> }));

const dc = copy.projects.data;

let spec: ProjectSpec;
function Spy() {
  const current = useProjectStore().spec;
  useEffect(() => {
    spec = current;
  });
  return null;
}

// A source a key result is measured from is read by the project: the Data
// step says so without its being typed again, and adds it to the list
// only when its details are to be said.
describe("a key result's source in the Data step", () => {
  it("is shown as read, and added to the list for its details", async () => {
    const user = userEvent.setup();
    const manifest = {
      apiVersion: "cartograph/v1",
      kind: "Project",
      metadata: { id: "p1", name: "Project one" },
      spec: { team: "t1", summary: {}, objectives: [{ objective: "Find faults early", keyResults: [{ id: "kr-1", metric: "Faults found", source: "check-records" }] }] },
    };
    const client = fakeClient({
      get: (async (kind: string) =>
        kind === "DataSource"
          ? { version: { number: 1 }, manifest: { apiVersion: "cartograph/v1", kind: "DataSource", metadata: { id: "check-records", name: "Check records" }, spec: {} }, yaml: "" }
          : { version: { number: 0 }, manifest, yaml: "" }) as never,
      list: async () => [] as never,
      saveWorking: async () => undefined,
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p1">
            <DataSection />
            <Spy />
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText(dc.measures(["Faults found"]))).toBeInTheDocument();
    expect(screen.queryByText(dc.usesEmpty)).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: dc.detailMeasured("Check records") }));
    expect(spec.data?.consumes).toEqual([{ source: "check-records", purpose: dc.measuresPurpose(["Faults found"]) }]);
    expect(await screen.findByText(dc.alsoMeasures(["Faults found"]))).toBeInTheDocument();
  });
});
