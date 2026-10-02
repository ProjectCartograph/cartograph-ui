// Whether anyone is at this window, for the sync socket.
//
// A deployment that scales to zero must not be held up by a window
// nobody is looking at (cartograph-engine docs/adr/0015). So the socket
// is open only while a person is here: the page visible, and some input
// within IDLE_MS. Hidden for HIDDEN_MS, or no input for IDLE_MS, and the
// socket closes; the next input, or the page shown again, opens it.
// Nothing is lost meanwhile: drafts are kept on this device and sync when
// the socket returns, and an edit is input, so it brings the socket back.

/** No input for this long and nobody is here. */
export const IDLE_MS = 2 * 60_000;

/** Hidden for this long and nobody is here: long enough that a glance at
 * another tab does not close the socket. */
export const HIDDEN_MS = 60_000;

/** What counts as someone being here. Pointer movement included: reading
 * with the pointer on the page is being here. */
const INPUT = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "focus"] as const;

export interface Attention {
  /** Whether someone is here now. */
  here(): boolean;
  /** Calls listener whenever that changes; returns the unsubscribe. */
  subscribe(listener: (here: boolean) => void): () => void;
  /** Stops listening to the page. */
  stop(): void;
}

export interface AttentionOptions {
  doc?: Document;
  win?: Window;
  now?: () => number;
  idleMs?: number;
  hiddenMs?: number;
}

/** Attention as the page shows it. */
export function pageAttention(opts: AttentionOptions = {}): Attention {
  const doc = opts.doc ?? document;
  const win = opts.win ?? window;
  const now = opts.now ?? Date.now;
  const idleMs = opts.idleMs ?? IDLE_MS;
  const hiddenMs = opts.hiddenMs ?? HIDDEN_MS;

  const listeners = new Set<(here: boolean) => void>();
  let lastInput = now();
  let hiddenSince = doc.visibilityState === "hidden" ? now() : undefined;
  let present = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function set(next: boolean) {
    if (next === present) return;
    present = next;
    for (const l of listeners) l(present);
  }

  // When the window next stops counting as attended, if nothing happens
  // before then.
  function schedule() {
    clearTimeout(timer);
    const t = now();
    const until = Math.min(
      lastInput + idleMs,
      hiddenSince === undefined ? Infinity : hiddenSince + hiddenMs,
    );
    if (until <= t) {
      set(false);
      return;
    }
    timer = setTimeout(schedule, until - t);
  }

  const onInput = () => {
    lastInput = now();
    if (doc.visibilityState !== "hidden") hiddenSince = undefined;
    set(true);
    schedule();
  };
  const onVisibility = () => {
    if (doc.visibilityState === "hidden") {
      hiddenSince = now();
    } else {
      // Shown again is someone looking.
      onInput();
      return;
    }
    schedule();
  };

  for (const e of INPUT) win.addEventListener(e, onInput, { passive: true });
  doc.addEventListener("visibilitychange", onVisibility);
  schedule();

  return {
    here: () => present,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      clearTimeout(timer);
      for (const e of INPUT) win.removeEventListener(e, onInput);
      doc.removeEventListener("visibilitychange", onVisibility);
      listeners.clear();
    },
  };
}

/** The part of a network adapter attention drives. */
export interface Pausable {
  peerId?: string;
  peerMetadata?: unknown;
  connect(peerId: never, peerMetadata?: never): void;
  disconnect(): void;
}

/**
 * Closes the socket while nobody is here and opens it when someone comes
 * back. The adapter's own retry stays for failures while someone is here;
 * disconnect() stops it, so an unattended window makes no connections at
 * all, and a server that closed the socket as idle is not answered with a
 * new one until someone returns.
 */
export function followAttention(adapter: Pausable, attention: Attention): () => void {
  let paused = false;
  return attention.subscribe((here) => {
    if (!here && !paused && adapter.peerId) {
      paused = true;
      adapter.disconnect();
    } else if (here && paused && adapter.peerId) {
      paused = false;
      adapter.connect(adapter.peerId as never, adapter.peerMetadata as never);
    }
  });
}
