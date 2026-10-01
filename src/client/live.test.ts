// The collaboration facet, two of it, joined by an in-memory channel the
// way two browsers are joined through the engine: what one does reaches
// the other, and both end in the same document.

// The full entry point initialises the WebAssembly for Node; the facet
// itself uses /slim, which shares the one module.
import "@automerge/automerge";
import { ImmutableString } from "@automerge/automerge/slim";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLive, type Live } from "./live";
import { EXPIRY_MS } from "./presence";
import type { Peer, PresenceChannel, SharedDraft } from "./port";

const session = (actor: string) => async () => ({ actor, name: actor.toUpperCase(), canWrite: true });

let lives: Live[] = [];
let channels: PresenceChannel[] = [];

/** Two sessions on one draft, and the presence document they share. */
async function pair() {
  const channel = new MessageChannel();
  const urls: Record<string, string> = {};
  const port = {
    locate: async (kind: string, id: string) => ({ documentId: "", url: urls[`${kind}/${id}`] }),
    presenceDocument: async () => ({ documentId: "", url: urls.presence }),
  };
  const a = createLive({ ...port, session: session("ada"), network: [new MessageChannelNetworkAdapter(channel.port1)], connectGraceMs: 60_000 });
  const b = createLive({ ...port, session: session("bo"), network: [new MessageChannelNetworkAdapter(channel.port2)], connectGraceMs: 60_000 });
  lives.push(a, b);
  // The engine creates the document; here the first session stands in for
  // it, with a sentence as text and an enum as a scalar string.
  const doc = a.repo.create({
    apiVersion: new ImmutableString("cartograph/v1"),
    kind: new ImmutableString("Goal"),
    metadata: { id: new ImmutableString("g1"), name: "Fewer late reports" },
    spec: {
      level: new ImmutableString("goal"),
      objective: "Reports arrive on time",
      keyResults: [{ id: new ImmutableString("kr-1"), metric: "Share on time", target: 90 }],
    },
  });
  urls["Goal/g1"] = doc.url;
  urls.presence = a.repo.create({}).url;
  const da = await a.openDraft("Goal", "g1");
  const db = await b.openDraft("Goal", "g1");
  return { a, b, da, db, url: doc.url, wire: channel };
}

/** Waits until both drafts read the same, and returns what they read. */
async function converged(x: SharedDraft, y: SharedDraft) {
  await vi.waitFor(() => expect(JSON.stringify(x.doc())).toBe(JSON.stringify(y.doc())), { timeout: 3000, interval: 10 });
  return x.doc() as { metadata: Record<string, unknown>; spec: Record<string, unknown> };
}

afterEach(async () => {
  for (const c of channels) c.close();
  channels = [];
  await Promise.all(lives.map((l) => l.shutdown()));
  lives = [];
  vi.useRealTimers();
});

describe("a shared draft", () => {
  it("reads as plain JSON, and knows text from a scalar string by the document", async () => {
    const { da } = await pair();
    expect(da.doc()).toMatchObject({ kind: "Goal", spec: { level: "goal", objective: "Reports arrive on time" } });
    expect(da.isText("/spec/objective")).toBe(true);
    expect(da.isText("/metadata/name")).toBe(true);
    expect(da.isText("/spec/level")).toBe(false);
    expect(da.isText("/spec/keyResults/{kr-1}/metric")).toBe(true);
  });

  it("converges when two sessions edit different fields at once", async () => {
    const { da, db } = await pair();
    da.change((e) => e.set("/spec/level", "objective"));
    db.change((e) => e.set("/spec/keyResults/0/target", 95));
    const doc = await converged(da, db);
    expect(doc.spec.level).toBe("objective");
    expect((doc.spec.keyResults as { target: number }[])[0].target).toBe(95);
  });

  it("keeps both people's words when they type in one sentence at once", async () => {
    const { da, db } = await pair();
    await converged(da, db);
    // Typed a character at a time, as a field sends it.
    for (const next of ["Reports arrive on time!", "Reports arrive on time!!"]) da.change((e) => e.set("/spec/objective", next));
    for (const next of ["Most reports arrive on time", "Most reports arrive on time"]) db.change((e) => e.set("/spec/objective", next));
    const doc = await converged(da, db);
    expect(doc.spec.objective).toBe("Most reports arrive on time!!");
    expect(da.conflicts()).toEqual([]);
  });

  it("keeps a scalar a scalar, and turns two values for it into a conflict with both", async () => {
    const { da, db } = await pair();
    await converged(da, db);
    da.change((e) => e.set("/spec/level", "objective"));
    db.change((e) => e.set("/spec/level", "outcome"));
    const doc = await converged(da, db);
    expect(da.isText("/spec/level")).toBe(false);
    const [conflict] = da.conflicts("/spec");
    expect(conflict.path).toBe("/spec/level");
    expect([conflict.value, ...conflict.others].sort()).toEqual(["objective", "outcome"]);
    expect(conflict.value).toBe(doc.spec.level);
    // Restoring the other value settles it for everyone.
    db.change((e) => e.replace("/spec/level", conflict.others[0]));
    await converged(da, db);
    await vi.waitFor(() => expect(da.conflicts()).toEqual([]));
    expect(da.doc()).toMatchObject({ spec: { level: conflict.others[0] } });
  });

  it("adds a list item in the shape its siblings have, and keeps the others' identity", async () => {
    const { da, db } = await pair();
    const before = da.doc() as { spec: { keyResults: unknown[] } };
    da.change((e) =>
      e.set("/spec/keyResults", [...before.spec.keyResults, { id: "kr-2", metric: "Share complete", target: 80 }]),
    );
    db.change((e) => e.set("/spec/keyResults/{kr-1}/metric", "Share of reports on time"));
    const doc = await converged(da, db);
    expect(doc.spec.keyResults).toEqual([
      { id: "kr-1", metric: "Share of reports on time", target: 90 },
      { id: "kr-2", metric: "Share complete", target: 80 },
    ]);
    expect(da.isText("/spec/keyResults/1/metric")).toBe(true);
    expect(da.isText("/spec/keyResults/1/id")).toBe(false);
  });

  it("gives a caret as a cursor that stays on its character while others type", async () => {
    const { da, db } = await pair();
    await converged(da, db);
    // "Reports arrive on time": a caret before "on".
    const cursor = da.cursor("/spec/objective", 15)!;
    expect(cursor).toBeTruthy();
    db.change((e) => e.set("/spec/objective", "All reports arrive on time"));
    await converged(da, db);
    expect(da.cursorPosition("/spec/objective", cursor)).toBe(19);
    expect(da.cursor("/spec/level", 0)).toBeUndefined();
  });

  it("tells each subscriber whether a change was its own", async () => {
    const { da, db } = await pair();
    const heard: boolean[] = [];
    const stop = da.subscribe((c) => heard.push(c.local));
    da.change((e) => e.set("/spec/level", "objective"));
    db.change((e) => e.set("/spec/objective", "Reports arrive early"));
    await converged(da, db);
    stop();
    expect(heard[0]).toBe(true);
    expect(heard).toContain(false);
  });
});

describe("presence", () => {
  beforeEach(() => {
    // Only the presence clock: the network and the repo keep real time.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  });

  async function joined(screen: { kind: string; id: string } | null) {
    const { a, b, url, wire } = await pair();
    const pa = await a.joinPresence(screen);
    const pb = await b.joinPresence(screen);
    channels.push(pa, pb);
    let seen: Peer[] = [];
    pb.subscribe((peers) => {
      seen = peers;
    });
    return { a, b, pa, pb, url, wire, seen: () => seen };
  }

  it("reaches the other session on a manifest's document", async () => {
    const { pa, seen } = await joined({ kind: "Goal", id: "g1" });
    pa.publish({ focus: { path: "/spec/objective" }, pointer: { target: "/spec/objective", x: 0.25, y: 0.5 } });
    await vi.waitFor(() => expect(seen()[0]?.focus).toEqual({ path: "/spec/objective" }));
    expect(seen()[0]).toMatchObject({ actor: "ada", name: "ADA", pointer: { target: "/spec/objective", x: 0.25, y: 0.5 } });
    expect(seen()[0].color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("reaches the other session on the presence document, away from a manifest", async () => {
    const { pa, seen } = await joined(null);
    pa.publish({ pointer: { target: "goal-tree", x: 0.5, y: 0.5 } });
    await vi.waitFor(() => expect(seen()[0]?.pointer?.target).toBe("goal-tree"));
  });

  it("forgets a session it has not heard from for ten seconds", async () => {
    const { pa, wire, seen } = await joined({ kind: "Goal", id: "g1" });
    pa.publish({ focus: { path: "/spec/level" } });
    await vi.waitFor(() => expect(seen()).toHaveLength(1));
    // The first session goes silent without saying so: its connection drops.
    wire.port1.close();
    vi.advanceTimersByTime(EXPIRY_MS - 1000);
    expect(seen()).toHaveLength(1);
    // Swept a quarter of a second at a time.
    vi.advanceTimersByTime(1250);
    expect(seen()).toHaveLength(0);
  });

  it("keeps a session that keeps its heartbeat", async () => {
    const { pa, seen } = await joined({ kind: "Goal", id: "g1" });
    pa.publish({ focus: { path: "/spec/level" } });
    await vi.waitFor(() => expect(seen()).toHaveLength(1));
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(3000);
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(seen()).toHaveLength(1);
  });

  it("sends the pointer at most twenty times a second, and always its last position", async () => {
    const { b, pa, url, seen } = await joined({ kind: "Goal", id: "g1" });
    await vi.waitFor(() => expect(seen()).toHaveLength(1));
    const handle = await b.repo.find(url);
    const pointers: unknown[] = [];
    handle.on("ephemeral-message", ({ message }) => {
      const m = message as { pointer?: unknown };
      if (m.pointer) pointers.push(m.pointer);
    });
    // Twenty moves inside one twentieth of a second.
    for (let i = 0; i < 20; i++) pa.publish({ pointer: { target: "/spec/objective", x: i / 20, y: 0.5 } });
    await new Promise((r) => setTimeout(r, 150));
    expect(pointers.length).toBeLessThanOrEqual(2);
    expect(pointers.at(-1)).toEqual({ target: "/spec/objective", x: 19 / 20, y: 0.5 });
  });

  it("removes a session at once when it leaves", async () => {
    const { pa, seen } = await joined({ kind: "Goal", id: "g1" });
    await vi.waitFor(() => expect(seen()).toHaveLength(1));
    pa.close();
    await vi.waitFor(() => expect(seen()).toHaveLength(0));
  });

  it("drops a payload the schema does not allow", async () => {
    const { a, url, seen } = await joined({ kind: "Goal", id: "g1" });
    const handle = await a.repo.find(url);
    const good = { v: 1, session: "s-12345678", actor: "eve", at: 1 };
    for (const bad of [
      { ...good, v: 2 },
      { ...good, session: "short" },
      { ...good, pointer: { target: "/spec", x: 2, y: 0 } },
      { ...good, color: "red" },
      { ...good, extra: true },
      { ...good, caret: { path: "/spec/objective", anchor: "a" } },
      "not an object",
    ]) {
      handle.broadcast(bad);
    }
    handle.broadcast({ ...good, session: "s-87654321" });
    await vi.waitFor(() => expect(seen().some((p) => p.session === "s-87654321")).toBe(true));
    expect(seen().some((p) => p.actor === "eve" && p.session !== "s-87654321")).toBe(false);
  });
});
