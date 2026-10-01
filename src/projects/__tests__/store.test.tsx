import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parse as parseYAML } from "yaml";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { NotFound, Refused } from "@/client/port";
import { ProjectStoreProvider, useProjectStore } from "../store";

// The store is exercised for real: the Client is faked at the port and the
// router's navigation guard is a no-op, nothing else.
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => undefined }));

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Project",
  metadata: { id: "p1", name: "Project one" },
  spec: { summary: { problem: "A problem", change: "A change" }, team: "t1" },
};

type Api = ReturnType<typeof useProjectStore>;
let api: Api | null = null;

function Probe() {
  api = useProjectStore();
  return <span>{api.loaded ? "loaded" : "loading"}</span>;
}

async function mountStore() {
  const queryClient = new QueryClient();
  render(
    <ClientProvider client={fakeClient({ get, saveWorking, saveVersion, snapshot, discardWorking })}>
      <QueryClientProvider client={queryClient}>
        <ProjectStoreProvider id="p1">
          <Probe />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
  await screen.findByText("loaded");
  if (!api) throw new Error("store not mounted");
  return api;
}

const get = vi.fn();
const saveWorking = vi.fn();
const saveVersion = vi.fn();
const snapshot = vi.fn();
const discardWorking = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  api = null;
  get.mockResolvedValue({ version: { number: 0 }, manifest, yaml: "" });
  saveWorking.mockResolvedValue(undefined);
  discardWorking.mockResolvedValue(undefined);
});

describe("ProjectStore", () => {
  it("autosave writes the working copy and never the validating PUT", async () => {
    const store = await mountStore();

    act(() => store.setName("Renamed project"));
    await act(async () => {
      await store.flushNow();
    });

    expect(saveWorking).toHaveBeenCalledTimes(1);
    const [kind, id, text] = saveWorking.mock.calls[0] as [string, string, string];
    expect([kind, id]).toEqual(["Project", "p1"]);
    const written = parseYAML(text) as typeof manifest;
    expect(written.metadata.name).toBe("Renamed project");
    expect(written.spec.summary).toEqual(manifest.spec.summary);
    expect(written.spec.team).toBe("t1");
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("Save as version posts the reason and surfaces the 422 problems without a new version", async () => {
    const store = await mountStore();
    const problems = [{ path: "/spec", message: "missing property 'deliverables'" }];
    snapshot.mockRejectedValueOnce(new Refused(problems));

    let result: Awaited<ReturnType<Api["saveVersion"]>> | undefined;
    await act(async () => {
      result = await store.saveVersion("first attempt");
    });

    expect(result).toEqual({ ok: false, problems });
    expect(snapshot).toHaveBeenCalledWith("Project", "p1", "first attempt");
    expect(api?.version).toBe(0);
  });

  it("Save as version records the new version number on success", async () => {
    const store = await mountStore();
    snapshot.mockResolvedValueOnce({ kind: "Project", id: "p1", number: 1, reason: "first", actor: "local", on: "2026-09-19T00:00:00Z" });

    let result: Awaited<ReturnType<Api["saveVersion"]>> | undefined;
    await act(async () => {
      result = await store.saveVersion("first");
    });

    expect(result).toEqual({ ok: true });
    expect(api?.version).toBe(1);
  });
});

// The StakeholderMap bound to a project is edited on the project's own
// Resources step, so it has to share the project's draft: one debounce,
// one flush chain, one "Saved", one discard. A map saving on its own
// cadence would sit outside "Discard draft" and quietly survive it.
describe("the project's draft carries its stakeholder map too", () => {
  /** A read that answers per kind, since the store loads two manifests
   * and reverts two on discard. */
  function routeGets(opts: { map?: { spec: unknown } | null }) {
    get.mockImplementation(async (kind: string) => {
      if (kind === "StakeholderMap") {
        if (!opts.map) throw new NotFound();
        return { version: { number: 0 }, manifest: { spec: opts.map.spec }, yaml: "" };
      }
      return { version: { number: 0 }, manifest, yaml: "" };
    });
  }

  it("writes nothing for a map nobody has scored", async () => {
    routeGets({ map: null });
    const store = await mountStore();

    act(() => store.setName("Renamed"));
    await act(async () => {
      await store.flushNow();
    });

    expect(saveWorking).toHaveBeenCalledTimes(1);
    expect(saveWorking.mock.calls[0][0]).toBe("Project");
  });

  it("writes the map first, then the project, in one flush", async () => {
    routeGets({ map: null });
    const store = await mountStore();

    act(() => store.setName("Renamed"));
    act(() =>
      store.updateMap((m) => ({ ...m, entries: [{ resource: "denominational-boards", influence: 3, interest: 2 }] })),
    );
    await act(async () => {
      await store.flushNow();
    });

    const puts = saveWorking.mock.calls as [string, string, string][];
    expect(puts.map((p) => p[0])).toEqual(["StakeholderMap", "Project"]);
    expect(puts[0][1]).toBe("p1-stakeholders");
    const written = parseYAML(puts[0][2]) as { kind: string; spec: { scope: unknown; entries: unknown[] } };
    expect(written.kind).toBe("StakeholderMap");
    expect(written.spec.scope).toEqual({ kind: "Project", id: "p1" });
    expect(written.spec.entries).toHaveLength(1);
  });

  it("loads the map that already exists", async () => {
    routeGets({
      map: { spec: { scope: { kind: "Project", id: "p1" }, entries: [{ resource: "other-ministries" }] } },
    });
    const store = await mountStore();
    expect(store.mapSpec.entries).toEqual([{ resource: "other-ministries" }]);
  });

  // A stakeholder declared but not yet assessed is a real entry. It has to
  // survive a save, or the shape loses the thing it exists to hold.
  it("saves an entry that carries no score", async () => {
    routeGets({ map: null });
    const store = await mountStore();

    act(() => store.updateMap((m) => ({ ...m, entries: [{ resource: "other-ministries" }] })));
    await act(async () => {
      await store.flushNow();
    });

    const puts = saveWorking.mock.calls as [string, string, string][];
    const written = parseYAML(puts[0][2]) as { spec: { entries: Record<string, unknown>[] } };
    expect(written.spec.entries[0]).toEqual({ resource: "other-ministries" });
  });
});

// Discard has had three shapes. First it cleared the dirty flag and re-read,
// which discarded nothing: a read answers with the draft when there is one.
// Then it overwrote the draft with the last version's text, because nothing
// on the server removed a draft -- the draft was the file. Drafts are staged
// now, so it deletes the draft and reads back the file the vault was holding.
describe("discarding a draft actually discards it", () => {
  it("deletes the draft and takes back what the vault holds", async () => {
    get.mockImplementation(async (kind: string) => {
      if (kind === "StakeholderMap") throw new NotFound();
      return { version: { number: 2 }, number: 2, manifest, yaml: "" };
    });

    const store = await mountStore();
    act(() => store.setName("A name nobody wanted"));
    await act(async () => {
      await store.discardDraft();
    });

    // Both halves of a project are drafts, so both are deleted.
    const kinds = discardWorking.mock.calls.map(([kind]) => kind);
    expect(kinds).toContain("Project");
    expect(kinds).toContain("StakeholderMap");

    // And nothing is written: a discard writes nothing anywhere. The old
    // shape wrote the last version back over the draft, which is what made
    // it look like a save in the vault's history.
    expect(saveWorking).not.toHaveBeenCalled();

    // What comes back is what the vault holds, not the name just typed.
    expect(store.name).not.toBe("A name nobody wanted");
  });

  // A project that was never saved has nothing to take back, so the draft
  // goes and a blank is what is left -- honest, rather than a version that
  // does not exist.
  it("leaves nothing behind for a never-saved draft", async () => {
    get.mockRejectedValue(new NotFound());

    const store = await mountStore();
    await act(async () => {
      await store.discardDraft();
    });
    expect(saveWorking).not.toHaveBeenCalled();
  });
});
