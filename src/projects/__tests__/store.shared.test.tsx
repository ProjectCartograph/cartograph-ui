// A project on its shared draft is versioned with a snapshot, as before:
// the snapshot is what starts its lifecycle. The document as this screen
// holds it goes first as the working copy, so edits that have not reached
// the engine yet are in the version.

import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parse as parseYAML } from "yaml";

import { ClientProvider } from "@/client/context";
import { NotFound, Refused } from "@/client/port";
import { sessions, type Sessions } from "@/client/testing";
import { ProjectStoreProvider, useProjectStore } from "../store";

vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined }));

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: { summary: { problem: "A problem", change: "A change" }, team: "t1" },
};

let live: Sessions | undefined;
afterEach(async () => {
  await live?.close();
  live = undefined;
});

type Api = ReturnType<typeof useProjectStore>;

async function mount(given: Parameters<typeof sessions>[2]) {
  live = sessions(1, { "Project/p1": { manifest, text: ["/spec/summary/problem"] } }, {
    get: vi.fn(async (kind: string) => {
      if (kind === "StakeholderMap") throw new NotFound();
      return { version: { number: 1 }, manifest } as never;
    }),
    ...given,
  });
  let api: Api | null = null;
  const seen = (store: Api) => {
    api = store;
  };
  function Probe({ onStore }: { onStore: (store: Api) => void }) {
    const store = useProjectStore();
    useEffect(() => onStore(store));
    return <span>{store.loaded ? "loaded" : "loading"}</span>;
  }
  render(
    <ClientProvider client={live.clients[0]}>
      <QueryClientProvider client={new QueryClient()}>
        <ProjectStoreProvider id="p1">
          <Probe onStore={seen} />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
  await screen.findByText("loaded");
  return () => api as unknown as Api;
}

describe("a project version saved from its shared draft", () => {
  it("sends the document as the working copy, then snapshots it", async () => {
    const order: string[] = [];
    const saveWorking = vi.fn(async () => void order.push("saveWorking"));
    const snapshot = vi.fn(async () => {
      order.push("snapshot");
      return { kind: "Project", id: "p1", number: 2, actor: "local", reason: "r", on: "" };
    });
    const saveVersion = vi.fn();
    const store = await mount({ saveWorking, snapshot, saveVersion });

    act(() => store().setName("Project renamed"));
    let result: Awaited<ReturnType<Api["saveVersion"]>> | undefined;
    await act(async () => {
      result = await store().saveVersion("first");
    });

    expect(result).toEqual({ ok: true });
    expect(order).toEqual(["saveWorking", "snapshot"]);
    const [kind, id, text] = saveWorking.mock.calls[0] as unknown as [string, string, string];
    expect([kind, id]).toEqual(["Project", "p1"]);
    expect(parseYAML(text)).toMatchObject({ metadata: { name: "Project renamed" }, spec: { team: "t1" } });
    expect(snapshot).toHaveBeenCalledWith("Project", "p1", "first");
    expect(saveVersion).not.toHaveBeenCalled();
    expect(store().version).toBe(2);
  });

  it("lands a refused snapshot's problems on their fields", async () => {
    const problems = [{ path: "/spec/summary/problem", message: "A problem is needed." }];
    const store = await mount({
      saveWorking: vi.fn(async () => {}),
      snapshot: vi.fn(async () => {
        throw new Refused(problems);
      }),
    });
    let result: Awaited<ReturnType<Api["saveVersion"]>> | undefined;
    await act(async () => {
      result = await store().saveVersion("first");
    });
    expect(result).toEqual({ ok: false, problems });
  });
});

// The stakeholder map names the project, and a reference to a project
// with no version is refused. So the map goes first only once the project
// has a version, which keeps a refused map from leaving a versioned
// project behind; on the first save the project has to go first.
describe("the order a project and its stakeholder map are versioned in", () => {
  const scoredSaves = async (versioned: boolean) => {
    const snapshotted: string[] = [];
    const store = await mount({
      saveWorking: vi.fn(async () => {}),
      snapshot: vi.fn(async (kind: string) => {
        snapshotted.push(kind);
        return { kind, id: "p1", number: 1, actor: "local", reason: "r", on: "" } as never;
      }),
      ...(versioned
        ? {}
        : {
            get: vi.fn(async () => {
              throw new NotFound();
            }),
          }),
    });
    act(() => store().updateMap((m) => ({ ...m, entries: [{ resource: "r1", influence: 2, interest: 3 }] })));
    let result: Awaited<ReturnType<Api["saveVersion"]>> | undefined;
    await act(async () => {
      result = await store().saveVersion("save");
    });
    return { result, snapshotted };
  };

  it("versions the project first when it has no version yet", async () => {
    const { result, snapshotted } = await scoredSaves(false);
    expect(result).toEqual({ ok: true });
    expect(snapshotted).toEqual(["Project", "StakeholderMap"]);
  });

  it("versions the map first once the project has a version", async () => {
    const { result, snapshotted } = await scoredSaves(true);
    expect(result).toEqual({ ok: true });
    expect(snapshotted).toEqual(["StakeholderMap", "Project"]);
  });
});
