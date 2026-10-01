/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { parse as parseYAML } from "yaml";

import { client } from "@/api/client";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "../store";
import { SaveBar } from "../SaveBar";

vi.mock("@/api/client");
vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const sc = copy.definition.save;
const mocked = vi.mocked(client);

const saved = { metadata: { id: "p1", name: "As the vault holds it" }, spec: { name: "As the vault holds it" } };

const ok = (data: unknown) => ({ data, error: undefined, response: new Response(null, { status: 200 }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocked.GET.mockImplementation((async () => ok({ number: 1, manifest: saved })) as never);
  mocked.PUT.mockImplementation((async () => ok(undefined)) as never);
  mocked.DELETE.mockImplementation((async () => ok(undefined)) as never);
});

type Api = ReturnType<typeof useDefinitionStore<{ name?: string }>>;

async function mount() {
  let api: Api | null = null;
  function Probe() {
    api = useDefinitionStore<{ name?: string }>();
    return <SaveBar />;
  }
  await act(async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DefinitionStoreProvider kind="Programme" id="p1" blank={() => ({})}>
          <Probe />
        </DefinitionStoreProvider>
      </QueryClientProvider>,
    );
  });
  return () => api as Api;
}

describe("the save that promotes a staged draft", () => {
  it("offers nothing to press until there is a draft", async () => {
    await mount();
    expect(screen.queryByRole("button", { name: sc.button })).not.toBeInTheDocument();
  });

  it("appears once autosave has staged something", async () => {
    const store = await mount();
    act(() => store().setName("Edited"));
    await act(async () => {
      await store().flushNow();
    });
    expect(screen.getByRole("button", { name: sc.button })).toBeInTheDocument();
    expect(screen.getByText(sc.staged)).toBeInTheDocument();
  });

  it("flushes the pending draft first, so it never promotes a stale one", async () => {
    const store = await mount();
    // No flush: the edit is still sitting behind the debounce.
    act(() => store().setName("Typed a moment ago"));
    await act(async () => {
      await store().save();
    });
    const puts = mocked.PUT.mock.calls as unknown as [string, { body: Record<string, unknown> }][];
    const working = puts.findIndex(([url]) => url === "/manifests/{kind}/{id}/working");
    const commit = puts.findIndex(([url]) => url === "/manifests/{kind}/{id}");
    expect(working).toBeGreaterThanOrEqual(0);
    expect(commit).toBeGreaterThan(working);
    // The text, not the object: sending a manifest as JSON loses the
    // order its file was written in.
    const body = puts[commit][1].body as { yaml: string };
    expect(parseYAML(body.yaml).metadata.name).toBe("Typed a moment ago");
  });

  it("stops offering a save once there is nothing left to promote", async () => {
    const store = await mount();
    act(() => store().setName("Edited"));
    await act(async () => {
      await store().flushNow();
    });
    await act(async () => {
      await store().save();
    });
    expect(screen.queryByRole("button", { name: sc.button })).not.toBeInTheDocument();
  });

  it("says what went wrong when the server refuses it", async () => {
    mocked.PUT.mockImplementation((async (url: string) => {
      if (url === "/manifests/{kind}/{id}") {
        return {
          data: undefined,
          error: { problems: [{ path: "/spec/aim", message: "An aim is needed." }] },
          response: new Response(null, { status: 422 }),
        };
      }
      return ok(undefined);
    }) as never);
    const store = await mount();
    act(() => store().setName("Edited"));
    await act(async () => {
      await store().flushNow();
    });
    await userEvent.click(screen.getByRole("button", { name: sc.button }));
    expect(screen.getByText("/spec/aim: An aim is needed.")).toBeInTheDocument();
    // Still staged: a refusal did not throw the work away.
    expect(screen.getByRole("button", { name: sc.button })).toBeInTheDocument();
  });
});

describe("discarding a staged draft", () => {
  it("deletes the draft and takes back what the vault holds", async () => {
    const store = await mount();
    act(() => store().setName("A name nobody wanted"));
    await act(async () => {
      await store().flushNow();
    });
    await act(async () => {
      await store().discardDraft();
    });
    const deletes = mocked.DELETE.mock.calls as unknown as [string, unknown][];
    expect(deletes.some(([url]) => url === "/manifests/{kind}/{id}/working")).toBe(true);
    expect(store().name).toBe("As the vault holds it");
    // And there is nothing left to save.
    expect(screen.queryByRole("button", { name: sc.button })).not.toBeInTheDocument();
  });
});
