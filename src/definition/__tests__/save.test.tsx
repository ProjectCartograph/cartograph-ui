/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { parse as parseYAML } from "yaml";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { Refused } from "@/client/port";
import { copy } from "@/copy";
import { DefinitionStoreProvider, useDefinitionStore } from "../store";
import { SaveBar } from "../SaveBar";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const sc = copy.definition.save;
const saved = { metadata: { id: "p1", name: "As the vault holds it" }, spec: { name: "As the vault holds it" } };
const version = { kind: "Programme", id: "p1", number: 2, actor: "local", reason: "save", on: "2026-09-01T00:00:00Z" };

const get = vi.fn();
const saveWorking = vi.fn();
const saveVersion = vi.fn();
const discardWorking = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  get.mockResolvedValue({ number: 1, manifest: saved });
  saveWorking.mockResolvedValue(undefined);
  saveVersion.mockResolvedValue(version);
  discardWorking.mockResolvedValue(undefined);
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
      <ClientProvider client={fakeClient({ get, saveWorking, saveVersion, discardWorking })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DefinitionStoreProvider kind="Programme" id="p1" blank={() => ({})}>
            <Probe />
          </DefinitionStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
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
    expect(saveWorking).toHaveBeenCalled();
    expect(saveVersion).toHaveBeenCalledTimes(1);
    expect(saveVersion.mock.invocationCallOrder[0]).toBeGreaterThan(saveWorking.mock.invocationCallOrder[0]);
    // The text, not the object: sending a manifest as JSON loses the
    // order its file was written in.
    const [kind, id, doc] = saveVersion.mock.calls[0] as [string, string, unknown];
    expect([kind, id]).toEqual(["Programme", "p1"]);
    expect(typeof doc).toBe("string");
    expect(parseYAML(doc as string).metadata.name).toBe("Typed a moment ago");
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
    saveVersion.mockRejectedValue(new Refused([{ path: "/spec/aim", message: "An aim is needed." }]));
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
    expect(discardWorking).toHaveBeenCalledWith("Programme", "p1");
    expect(store().name).toBe("As the vault holds it");
    // And there is nothing left to save.
    expect(screen.queryByRole("button", { name: sc.button })).not.toBeInTheDocument();
  });
});
