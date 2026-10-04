import { useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parse } from "yaml";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { NotFound } from "@/client/port";
import { ProjectStoreProvider, useProjectStore } from "@/projects/store";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined }));

let api: ReturnType<typeof useProjectStore> | null = null;
function Probe() {
  const store = useProjectStore();
  useEffect(() => {
    api = store;
  });
  return <span>{store.loaded ? "loaded" : "loading"}</span>;
}

// A placeholder holds a reference's place until what it names is defined
// (engine TAXONOMY.md D31): it is read from the record, kept by the store,
// and saved with the project, and naming the reference ends it.
describe("a placeholder on a project", () => {
  it("is read, changed and saved with the project", async () => {
    const saved: string[] = [];
    const client = fakeClient({
      get: async (kind) => {
        if (kind !== "Project") throw new NotFound();
        return {
          version: { number: 1 },
          manifest: {
            apiVersion: "cartograph/v1",
            kind: "Project",
            metadata: { id: "p1", name: "Rollout", pending: [{ path: "/spec/operation", kind: "Operation", name: "Quality Check Service" }] },
            spec: { team: "t1" },
          },
          yaml: "",
        } as never;
      },
      saveWorking: async (_kind: string, _id: string, yaml: string) => {
        saved.push(yaml);
      },
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient()}>
          <ProjectStoreProvider id="p1">
            <Probe />
          </ProjectStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    await screen.findByText("loaded");
    expect(api!.pending).toEqual([{ path: "/spec/operation", kind: "Operation", name: "Quality Check Service" }]);

    await act(async () => {
      api!.setPending([]);
      api!.updateSpec((s) => ({ ...s, operation: "quality-check-service" }));
      await api!.flushNow();
    });
    const last = parse(saved[saved.length - 1]);
    expect(last.metadata.pending).toBeUndefined();
    expect(last.spec.operation).toBe("quality-check-service");

    await act(async () => {
      api!.setPending([{ path: "/spec/operation", kind: "Operation", name: "Another" }]);
      await api!.flushNow();
    });
    expect(parse(saved[saved.length - 1]).metadata.pending).toEqual([{ path: "/spec/operation", kind: "Operation", name: "Another" }]);
  });
});
