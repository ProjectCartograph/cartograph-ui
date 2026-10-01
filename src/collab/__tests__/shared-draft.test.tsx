/// <reference types="@testing-library/jest-dom" />
// Two people on one programme, each with their own screen and their own
// session, joined the way the engine joins them: edits arrive live, a
// sentence typed by both keeps both people's words, the local caret stays
// put while the other's edit lands, and two values for one field become a
// note with the other value restorable.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import type { Client } from "@/client/port";
import { sessions, type Sessions } from "@/client/testing";
import { copy } from "@/copy";
import { ConflictNotes } from "@/collab/ConflictNotes";
import { OfflineNote } from "@/collab/OfflineNote";
import { DefinitionStoreProvider, useDefinitionStore } from "@/definition/store";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

interface Spec {
  aim?: string;
  status?: string;
}

const manifest = {
  apiVersion: "cartograph/v1",
  kind: "Programme",
  metadata: { id: "p1", name: "Faster reporting" },
  spec: { aim: "Reports arrive on time", status: "draft" },
};

function Fields({ who }: { who: string }) {
  const store = useDefinitionStore<Spec>();
  if (!store.loaded) return null;
  return (
    <section data-testid={who}>
      <label htmlFor={`${who}-aim`}>Aim</label>
      <textarea
        id={`${who}-aim`}
        data-cartograph-field="/spec/aim"
        value={store.spec.aim ?? ""}
        onChange={(e) => store.updateSpec((s) => ({ ...s, aim: e.target.value }))}
      />
      <label htmlFor={`${who}-status`}>Status</label>
      <input
        id={`${who}-status`}
        data-cartograph-field="/spec/status"
        value={store.spec.status ?? ""}
        onChange={(e) => store.updateSpec((s) => ({ ...s, status: e.target.value }))}
      />
      <ConflictNotes conflicts={store.conflicts} onResolve={store.resolveConflict} />
    </section>
  );
}

function screenFor(client: Client, who: string) {
  return (
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DefinitionStoreProvider kind="Programme" id="p1" blank={() => ({})}>
          <Fields who={who} />
        </DefinitionStoreProvider>
      </QueryClientProvider>
    </ClientProvider>
  );
}

let live: Sessions;
const saveWorking = vi.fn();

beforeEach(() => {
  saveWorking.mockReset();
  live = sessions(2, { "Programme/p1": { manifest, text: ["/spec/aim", "/metadata/name"] } }, {
    get: async () => ({ manifest, yaml: "" }) as never,
    saveWorking,
  });
});

afterEach(async () => {
  await live.close();
});

async function open() {
  render(
    <>
      {screenFor(live.clients[0], "ada")}
      {screenFor(live.clients[1], "bo")}
    </>,
  );
  const ada = await screen.findByTestId("ada");
  const bo = await screen.findByTestId("bo");
  const field = (who: HTMLElement, path: string) =>
    who.querySelector(`[data-cartograph-field="${path}"]`) as HTMLTextAreaElement | HTMLInputElement;
  return { ada, bo, field };
}

/** Types into a field the way a person does: the caret where they put it,
 * then the value with the new text at the caret. */
function typeAt(el: HTMLTextAreaElement | HTMLInputElement, at: number, text: string) {
  act(() => {
    el.focus();
    el.setSelectionRange(at, at);
  });
  const next = el.value.slice(0, at) + text + el.value.slice(at);
  fireEvent.change(el, { target: { value: next, selectionStart: at + text.length, selectionEnd: at + text.length } });
  act(() => el.setSelectionRange(at + text.length, at + text.length));
}

describe("a definition on its shared draft", () => {
  it("shows the other person's edit live, and never writes a working copy", async () => {
    const { ada, bo, field } = await open();
    typeAt(field(ada, "/spec/aim"), 0, "All ");
    await waitFor(() => expect(field(bo, "/spec/aim").value).toBe("All Reports arrive on time"));
    expect(saveWorking).not.toHaveBeenCalled();
  });

  it("keeps both people's words when both type in one sentence", async () => {
    const { ada, bo, field } = await open();
    typeAt(field(ada, "/spec/aim"), 0, "All ");
    typeAt(field(bo, "/spec/aim"), "Reports arrive on time".length, "!");
    const merged = "All Reports arrive on time!";
    await waitFor(() => expect(field(ada, "/spec/aim").value).toBe(merged));
    await waitFor(() => expect(field(bo, "/spec/aim").value).toBe(merged));
  });

  it("keeps the local caret where it was while the other's edit lands ahead of it", async () => {
    const { ada, bo, field } = await open();
    const mine = field(bo, "/spec/aim");
    // Bo's caret sits before "on".
    act(() => {
      mine.focus();
      mine.setSelectionRange(15, 15);
    });
    // Ada's edit, from her own screen: Bo's field keeps the focus here.
    const theirs = field(ada, "/spec/aim");
    fireEvent.change(theirs, { target: { value: "Most " + theirs.value } });
    await waitFor(() => expect(mine.value).toBe("Most Reports arrive on time"));
    expect(document.activeElement).toBe(mine);
    expect(mine.selectionStart).toBe(20);
    expect(mine.value.slice(mine.selectionStart!)).toBe("on time");
  });

  it("turns two values set at once into a note, with the other value restorable", async () => {
    const { ada, bo, field } = await open();
    // Both set the scalar status in one tick, before either hears the other.
    fireEvent.change(field(ada, "/spec/status"), { target: { value: "active" } });
    fireEvent.change(field(bo, "/spec/status"), { target: { value: "paused" } });
    const note = await within(ada).findByRole("region", { name: copy.collab.conflictsTitle }, { timeout: 3000 });
    expect(note).toHaveTextContent(copy.collab.conflict("Status"));
    await waitFor(() => expect(field(bo, "/spec/status").value).toBe(field(ada, "/spec/status").value));
    const showing = field(ada, "/spec/status").value;
    const other = showing === "active" ? "paused" : "active";
    expect(note).toHaveTextContent(other);
    fireEvent.click(within(note).getByRole("button", { name: copy.collab.conflictRestore }));
    await waitFor(() => expect(field(bo, "/spec/status").value).toBe(other));
    await waitFor(() => expect(within(ada).queryByRole("region", { name: copy.collab.conflictsTitle })).toBeNull());
    await waitFor(() => expect(within(bo).queryByRole("region", { name: copy.collab.conflictsTitle })).toBeNull());
  });
});

describe("the connection", () => {
  it("says so quietly while it is down, and editing carries on", async () => {
    let tell: (s: "online" | "offline") => void = () => {};
    const client: Client = {
      ...live.clients[0],
      watchConnection: (l) => {
        tell = l;
        l("online");
        return () => {};
      },
    };
    render(
      <ClientProvider client={client}>
        <OfflineNote />
      </ClientProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    act(() => tell("offline"));
    expect(screen.getByRole("status")).toHaveTextContent(copy.collab.offline);
    act(() => tell("online"));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
