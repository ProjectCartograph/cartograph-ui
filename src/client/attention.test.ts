import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { followAttention, HIDDEN_MS, IDLE_MS, pageAttention, type Pausable } from "./attention";

let visibility: DocumentVisibilityState = "visible";

function show(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("attention", () => {
  it("lapses after the idle time without input, and returns with input", () => {
    const a = pageAttention({ now: () => Date.now() });
    const seen: boolean[] = [];
    a.subscribe((here) => seen.push(here));
    expect(a.here()).toBe(true);

    vi.advanceTimersByTime(IDLE_MS - 1000);
    window.dispatchEvent(new Event("pointermove"));
    vi.advanceTimersByTime(IDLE_MS - 1000);
    expect(a.here()).toBe(true); // input kept it

    vi.advanceTimersByTime(2000);
    expect(a.here()).toBe(false);

    window.dispatchEvent(new Event("keydown"));
    expect(a.here()).toBe(true);
    expect(seen).toEqual([false, true]);
    a.stop();
  });

  it("lapses when hidden, but not for a glance at another tab", () => {
    const a = pageAttention({ now: () => Date.now() });
    show("hidden");
    vi.advanceTimersByTime(HIDDEN_MS / 2);
    show("visible");
    expect(a.here()).toBe(true);

    show("hidden");
    vi.advanceTimersByTime(HIDDEN_MS + 1);
    expect(a.here()).toBe(false);

    show("visible");
    expect(a.here()).toBe(true);
    a.stop();
  });
});

describe("followAttention", () => {
  it("closes the socket while nobody is here and opens it when they return", () => {
    const a = pageAttention({ now: () => Date.now() });
    const socket: Pausable & { calls: string[] } = {
      peerId: "me",
      peerMetadata: {},
      calls: [],
      connect() {
        this.calls.push("connect");
      },
      disconnect() {
        this.calls.push("disconnect");
      },
    };
    followAttention(socket, a);

    vi.advanceTimersByTime(IDLE_MS + 1);
    vi.advanceTimersByTime(10 * IDLE_MS); // still away: nothing more
    expect(socket.calls).toEqual(["disconnect"]);

    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("pointerdown"));
    expect(socket.calls).toEqual(["disconnect", "connect"]);
    a.stop();
  });

  it("leaves a socket the repo has not opened yet alone", () => {
    const a = pageAttention({ now: () => Date.now() });
    const socket: Pausable & { calls: string[] } = {
      calls: [],
      connect() {
        this.calls.push("connect");
      },
      disconnect() {
        this.calls.push("disconnect");
      },
    };
    followAttention(socket, a);
    vi.advanceTimersByTime(IDLE_MS + 1);
    expect(socket.calls).toEqual([]);
    a.stop();
  });
});
