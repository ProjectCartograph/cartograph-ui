/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { NotFound, Refused } from "@/client/port";
import { ProjectStoreProvider, useProjectStore } from "@/projects/store";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined }));

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "proj-1", name: "Project one" },
  spec: { team: "t1" },
};

const transition = vi.fn();

let api: ReturnType<typeof useProjectStore> | null = null;
function Probe() {
  api = useProjectStore();
  return <span>{api.loaded ? "loaded" : "loading"}</span>;
}

async function mountStore() {
  const client = fakeClient({
    get: async (kind) => {
      if (kind !== "Project") throw new NotFound();
      return { version: { number: 1 }, manifest, yaml: "" } as never;
    },
    transition,
  });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient()}>
        <ProjectStoreProvider id="proj-1">
          <Probe />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
  await screen.findByText("loaded");
  return api!;
}

// The handoff screen shows what store.handoff() answers: the refusal's
// problems in an alert, or the bundle's files.
describe("handing a project off", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api = null;
  });

  it("answers a refusal with the server's problems", async () => {
    const problems = [
      { path: "/spec/title", message: "Project title is required" },
      { path: "/spec/aim", message: "Project aim is required" },
    ];
    transition.mockRejectedValueOnce(new Refused(problems));
    const store = await mountStore();

    let result: Awaited<ReturnType<typeof store.handoff>> | undefined;
    await act(async () => {
      result = await store.handoff();
    });

    expect(transition).toHaveBeenCalledWith("proj-1", "handed off");
    expect(result).toEqual({ ok: false, problems });
  });

  it("answers a handoff with the snapshot and the bundle it wrote", async () => {
    const bundle = "proj-1/version-1/charter-proj-1-version-1.html";
    transition.mockResolvedValueOnce({
      state: "handed off",
      history: [{ state: "handed off", actor: "local", on: "2026-09-01T00:00:00Z", snapshot: 1, bundle }],
    });
    const store = await mountStore();

    let result: Awaited<ReturnType<typeof store.handoff>> | undefined;
    await act(async () => {
      result = await store.handoff();
    });

    expect(result).toEqual({ ok: true, snapshot: 1, bundle });
  });
});
