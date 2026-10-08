import { useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { NotFound } from "@/client/port";
import { WorkTextProvider } from "@/components/relevance";
import { DataSection } from "@/projects/sections/DataSection";
import { ProjectStoreProvider, useProjectStore } from "@/projects/store";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined, Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a> }));

let api: ReturnType<typeof useProjectStore> | null = null;
function Probe() {
  const store = useProjectStore();
  useEffect(() => {
    api = store;
  });
  return <span>{store.loaded ? "loaded" : "loading"}</span>;
}

// A data source the workspace already holds is suggested for what the
// project reads, and picking it adds the line; once named, used or
// produced, a source is no longer suggested (engine docs/adr/0023).
describe("a suggested data source", () => {
  it("adds the line it reads, then stops suggesting it", async () => {
    const client = fakeClient({
      get: async (kind) => {
        if (kind !== "Project") throw new NotFound();
        return { version: { number: 1 }, manifest: { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Rollout" }, spec: { team: "t1", data: { produces: [{ output: "newDataSource", sink: "depot-register", purpose: "Depots", refresh: "daily", personalData: "none" }] } } }, yaml: "" } as never;
      },
      saveWorking: async () => {},
      list: async () => [],
      relevant: async () => ({
        available: true,
        matches: [
          { kind: "DataSource", id: "collection-log", name: "Collection log", likelihood: 0.8, by: "model" },
          { kind: "DataSource", id: "depot-register", name: "Depot register", likelihood: 0.9, by: "model" },
        ],
      }),
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProjectStoreProvider id="p1">
            <Probe />
            <WorkTextProvider text="Add more collection trucks so produce reaches a depot the same day">
              <DataSection />
            </WorkTextProvider>
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    await screen.findByText("loaded");
    fireEvent.click(await screen.findByRole("button", { name: /Collection log/ }));
    expect(api!.spec.data?.consumes?.map((c) => c.source)).toEqual(["collection-log"]);
    // Named now, and the source the project produces never was offered.
    expect(screen.queryByRole("button", { name: /Collection log/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Depot register/ })).toBeNull();
  });
});
