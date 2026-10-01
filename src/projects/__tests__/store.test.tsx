import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parse as parseYAML } from "yaml";
import { client } from "@/api/client";
import { ProjectStoreProvider, useProjectStore } from "../store";

// The store is exercised for real: the API client is faked at the module
// boundary and the router's navigation guard is a no-op, nothing else.
vi.mock("@/api/client");
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
    <QueryClientProvider client={queryClient}>
      <ProjectStoreProvider id="p1">
        <Probe />
      </ProjectStoreProvider>
    </QueryClientProvider>,
  );
  await screen.findByText("loaded");
  if (!api) throw new Error("store not mounted");
  return api;
}

const mocked = vi.mocked(client);

beforeEach(() => {
  vi.clearAllMocks();
  api = null;
  mocked.GET.mockResolvedValue({
    data: { version: { number: 0 }, manifest, yaml: "" },
    error: undefined,
    response: new Response(null, { status: 200 }),
  } as never);
  mocked.PUT.mockResolvedValue({
    data: undefined,
    error: undefined,
    response: new Response(null, { status: 204 }),
  } as never);
});

describe("ProjectStore", () => {
  it("autosave writes the working copy and never the validating PUT", async () => {
    const store = await mountStore();

    act(() => store.setName("Renamed project"));
    await act(async () => {
      await store.flushNow();
    });

    const puts = mocked.PUT.mock.calls;
    expect(puts.length).toBe(1);
    const [path, options] = puts[0] as unknown as [string, { params: { path: { kind: string; id: string } }; body: { yaml: string } }];
    expect(path).toBe("/manifests/{kind}/{id}/working");
    expect(options.params.path).toEqual({ kind: "Project", id: "p1" });
    const written = parseYAML(options.body.yaml) as typeof manifest;
    expect(written.metadata.name).toBe("Renamed project");
    expect(written.spec.summary).toEqual(manifest.spec.summary);
    expect(written.spec.team).toBe("t1");
    expect(puts.some(([p]) => p === "/manifests/{kind}/{id}")).toBe(false);
  });

  it("Save as version posts the reason and surfaces the 422 problems without a new version", async () => {
    const store = await mountStore();
    const problems = [{ path: "/spec", message: "missing property 'deliverables'" }];
    mocked.POST.mockResolvedValueOnce({
      data: undefined,
      error: { problems },
      response: new Response(null, { status: 422 }),
    } as never);

    let result: Awaited<ReturnType<Api["saveVersion"]>> | undefined;
    await act(async () => {
      result = await store.saveVersion("first attempt");
    });

    expect(result).toEqual({ ok: false, problems });
    const [path, options] = mocked.POST.mock.calls[0] as unknown as [string, { body: { reason: string } }];
    expect(path).toBe("/manifests/{kind}/{id}/snapshots");
    expect(options.body).toEqual({ reason: "first attempt" });
    expect(api?.version).toBe(0);
  });

  it("Save as version records the new version number on success", async () => {
    const store = await mountStore();
    mocked.POST.mockResolvedValueOnce({
      data: { kind: "Project", id: "p1", number: 1, reason: "first", actor: "local", on: "2026-09-19T00:00:00Z" },
      error: undefined,
      response: new Response(null, { status: 200 }),
    } as never);

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
  /** A GET mock that answers per kind, since the store now loads two
   * manifests and reverts two on discard. */
  function routeGets(opts: {
    map?: { spec: unknown } | null;
    projectVersions?: { number: number }[];
    mapVersions?: { number: number }[];
    projectVersionYAML?: string;
    mapVersionYAML?: string;
  }) {
    mocked.GET.mockImplementation((async (url: string, init?: { params?: { path?: { kind?: string } } }) => {
      const kind = init?.params?.path?.kind;
      const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });
      if (url === "/manifests/{kind}/{id}/versions") {
        return ok(kind === "StakeholderMap" ? (opts.mapVersions ?? []) : (opts.projectVersions ?? []));
      }
      if (url === "/manifests/{kind}/{id}/versions/{n}") {
        return ok(
          kind === "StakeholderMap"
            ? { manifest: { spec: { scope: { kind: "Project", id: "p1" }, entries: [] } }, yaml: opts.mapVersionYAML ?? "" }
            : { manifest, yaml: opts.projectVersionYAML ?? "" },
        );
      }
      if (kind === "StakeholderMap") {
        if (!opts.map) return { data: undefined, error: { problems: [] }, response: new Response(null, { status: 404 }) };
        return ok({ version: { number: 0 }, manifest: { spec: opts.map.spec }, yaml: "" });
      }
      return ok({ version: { number: 0 }, manifest, yaml: "" });
    }) as never);
  }

  it("writes nothing for a map nobody has scored", async () => {
    routeGets({ map: null });
    const store = await mountStore();

    act(() => store.setName("Renamed"));
    await act(async () => {
      await store.flushNow();
    });

    const puts = mocked.PUT.mock.calls as unknown as [string, { params: { path: { kind: string } } }][];
    expect(puts.length).toBe(1);
    expect(puts[0][1].params.path.kind).toBe("Project");
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

    const puts = mocked.PUT.mock.calls as unknown as [string, { params: { path: { kind: string; id: string } }; body: { yaml: string } }][];
    expect(puts.map((p) => p[1].params.path.kind)).toEqual(["StakeholderMap", "Project"]);
    expect(puts[0][1].params.path.id).toBe("p1-stakeholders");
    const written = parseYAML(puts[0][1].body.yaml) as { kind: string; spec: { scope: unknown; entries: unknown[] } };
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

    const puts = mocked.PUT.mock.calls as unknown as [string, { body: { yaml: string } }][];
    const written = parseYAML(puts[0][1].body.yaml) as { spec: { entries: Record<string, unknown>[] } };
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
    mocked.GET.mockImplementation((async (url: string, init?: { params?: { path?: { kind?: string } } }) => {
      const kind = init?.params?.path?.kind;
      const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });
      if (kind === "StakeholderMap") {
        return { data: undefined, error: { problems: [] }, response: new Response(null, { status: 404 }) };
      }
      return ok({ version: { number: 2 }, number: 2, manifest, yaml: "" });
    }) as never);

    const store = await mountStore();
    act(() => store.setName("A name nobody wanted"));
    await act(async () => {
      await store.discardDraft();
    });

    // Both halves of a project are drafts, so both are deleted.
    const deletes = mocked.DELETE.mock.calls as unknown as [
      string,
      { params: { path: { kind: string } } },
    ][];
    const kinds = deletes
      .filter(([url]) => url === "/manifests/{kind}/{id}/working")
      .map(([, o]) => o.params.path.kind);
    expect(kinds).toContain("Project");
    expect(kinds).toContain("StakeholderMap");

    // And nothing is written: a discard writes nothing anywhere. The old
    // shape wrote the last version back over the draft, which is what made
    // it look like a save in the vault's history.
    expect(mocked.PUT).not.toHaveBeenCalled();

    // What comes back is what the vault holds, not the name just typed.
    expect(store.name).not.toBe("A name nobody wanted");
  });

  // A project that was never saved has nothing to take back, so the draft
  // goes and a blank is what is left -- honest, rather than a version that
  // does not exist.
  it("leaves nothing behind for a never-saved draft", async () => {
    mocked.GET.mockImplementation((async () => ({
      data: undefined,
      error: { problems: [] },
      response: new Response(null, { status: 404 }),
    })) as never);

    const store = await mountStore();
    await act(async () => {
      await store.discardDraft();
    });
    expect(mocked.PUT).not.toHaveBeenCalled();
  });
});
