// An edit made with no connection is kept on this device, survives a
// reload, and reaches everyone else when the connection returns: the draft
// lives in IndexedDB as well as on the engine.

import "fake-indexeddb/auto";
import { ImmutableString } from "@automerge/automerge/slim";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import "./testing";
import { createLive, type Live, type LiveOptions } from "./live";

let lives: Live[] = [];
afterEach(async () => {
  await Promise.all(lives.map((l) => l.shutdown()));
  lives = [];
});

function live(opts: Partial<LiveOptions> & Pick<LiveOptions, "network">): Live {
  const l = createLive({
    locate: async () => {
      throw new Error("offline");
    },
    presenceDocument: async () => {
      throw new Error("offline");
    },
    session: async () => ({ actor: "ada", canWrite: true }),
    connectGraceMs: 50,
    findTimeoutMs: 2000,
    ...opts,
  });
  lives.push(l);
  return l;
}

describe("a draft with no connection", () => {
  it("keeps an offline edit through a reload, and syncs it when the connection returns", async () => {
    const remembered = new Map<string, string>();
    const remember = { get: (k: string) => remembered.get(k), set: (k: string, v: string) => void remembered.set(k, v) };
    const db = `cartograph-test-${Math.random()}`;

    // Online: the engine holds the draft, and this device opens it.
    const first = new MessageChannel();
    const engine = live({ network: [new MessageChannelNetworkAdapter(first.port1)] });
    const url = engine.repo.create({ kind: new ImmutableString("Goal"), spec: { objective: "Reports arrive on time" } }).url;
    const online = live({
      network: [new MessageChannelNetworkAdapter(first.port2)],
      storage: new IndexedDBStorageAdapter(db),
      remember,
      locate: async () => ({ documentId: "", url }),
    });
    const seen = await online.openDraft("Goal", "g1");
    expect(seen.doc()).toMatchObject({ spec: { objective: "Reports arrive on time" } });
    await online.repo.flush();
    await online.shutdown();
    lives = lives.filter((l) => l !== online);

    // A reload with no connection: the lookup fails, the copy here opens.
    const offline = live({ network: [], storage: new IndexedDBStorageAdapter(db), remember });
    const statuses: string[] = [];
    offline.watchConnection((s) => statuses.push(s));
    const draft = await offline.openDraft("Goal", "g1");
    draft.change((e) => e.set("/spec/objective", "Most reports arrive on time"));
    await vi.waitFor(() => expect(statuses).toContain("offline"));
    await offline.repo.flush();
    await offline.shutdown();
    lives = lives.filter((l) => l !== offline);

    // Another reload, and the connection is back.
    const second = new MessageChannel();
    engine.repo.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(second.port1));
    const back = live({ network: [new MessageChannelNetworkAdapter(second.port2)], storage: new IndexedDBStorageAdapter(db), remember });
    const again = await back.openDraft("Goal", "g1");
    expect(again.doc()).toMatchObject({ spec: { objective: "Most reports arrive on time" } });
    const atEngine = await engine.repo.find<{ spec: { objective: string } }>(url as never);
    await vi.waitFor(() => expect(atEngine.doc().spec.objective).toBe("Most reports arrive on time"), { timeout: 3000 });
  });
});
