// The collaboration facet of the Client port over automerge-repo
// (docs/adr/0007): shared drafts as Automerge documents, presence as
// ephemeral messages on a screen's document. This file and the browser
// wiring beside it are the only places Automerge appears; `just wire` fails
// an @automerge import anywhere outside src/client.
//
// Transport-free: the network adapters and the storage are given, so a test
// joins two of these over an in-memory channel and the browser joins one to
// the engine's sync socket (./browser-live.ts).

import * as A from "@automerge/automerge/slim";
import {
  Repo,
  type DocHandle,
  type NetworkAdapterInterface,
  type StorageAdapterInterface,
} from "@automerge/automerge-repo/slim";

import { formatPointer, resolvePointer, within } from "./pointer";
import {
  HEARTBEAT_MS,
  POINTER_MS,
  PeerSet,
  colorFor,
  messageFor,
  newSession,
  type Sender,
} from "./presence";
import type {
  ConnectionStatus,
  DraftChange,
  DraftEditor,
  FieldConflict,
  ManifestDocument,
  Peer,
  PresenceChannel,
  PresenceScreen,
  PresenceState,
  Session,
  SharedDocument,
  SharedDraft,
} from "./port";

type Prop = string | number;
type Node = Record<string, unknown> | unknown[];

/** What the live side needs from the rest of the port. */
export interface LiveOptions {
  network: NetworkAdapterInterface[];
  /** Keeps documents on this device, so edits made offline survive a reload. */
  storage?: StorageAdapterInterface;
  /** The id of a manifest's draft (GET /manifests/{kind}/{id}/document). */
  locate: (kind: string, id: string) => Promise<SharedDocument>;
  /** The presence document (GET /presence). */
  presenceDocument: () => Promise<SharedDocument>;
  /** Who this session is (GET /session). */
  session: () => Promise<Session>;
  /** Remembers where a manifest's draft is, so a reload with no connection
   * still finds the copy on this device. */
  remember?: { get(key: string): string | undefined; set(key: string, url: string): void };
  /** How long to wait for a document nobody has yet. */
  findTimeoutMs?: number;
  /** How long "connecting" may last before it reads as offline. */
  connectGraceMs?: number;
  /** The route a screen reports in presence. */
  route?: () => string;
}

/** The collaboration half of the Client. */
export interface Live {
  openDraft(kind: string, id: string): Promise<SharedDraft>;
  joinPresence(screen: PresenceScreen): Promise<PresenceChannel>;
  watchConnection(listener: (status: ConnectionStatus) => void): () => void;
  /** Stops syncing; for tests and for a page being torn down. */
  shutdown(): Promise<void>;
  /** The repo underneath, for tests that need to reach past the facet. */
  readonly repo: Repo;
}

// ---------------------------------------------------------------------------
// Reading Automerge as plain JSON.

// Inside a change a list is a proxy that answers yes to Automerge's own
// isImmutableString and isCounter, so a list is ruled out first.
function isScalarString(v: unknown): v is A.ImmutableString {
  return !Array.isArray(v) && A.isImmutableString(v);
}

function isCounter(v: unknown): v is A.Counter {
  return !Array.isArray(v) && A.isCounter(v);
}

function isMap(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    !A.isImmutableString(v) &&
    !A.isCounter(v) &&
    !(v instanceof Date) &&
    !(v instanceof Uint8Array)
  );
}

/** A document, or a part of one, as plain JSON: scalar strings and text
 * both as strings, counters as numbers. */
export function plain(v: unknown): unknown {
  if (isScalarString(v)) return v.val;
  if (isCounter(v)) return v.value;
  if (Array.isArray(v)) return v.map(plain);
  if (v instanceof Date) return v.toISOString();
  if (isMap(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = plain(x);
    return out;
  }
  return v;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(plain(a)) === JSON.stringify(plain(b));
}

function at(root: unknown, path: Prop[]): unknown {
  let node: unknown = root;
  for (const p of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string | number, unknown>)[p];
  }
  return node;
}

// ---------------------------------------------------------------------------
// Writing plain JSON into Automerge.
//
// The UI never decides which strings are text. Automerge 3 reads a text
// field as a JS string and a scalar string as an ImmutableString, so a
// field already in the document says what it is, and an edit keeps it so.
// A field the document does not hold yet takes the shape of the same field
// in a sibling list item; with nothing to go by it is a scalar, which is
// never wrong: two concurrent writes to it surface as a conflict to choose
// between rather than as interleaved characters.

type Template = unknown;

/** A new value, in the shape `template` (the same field elsewhere) has. */
function fresh(value: unknown, template: Template): unknown {
  if (typeof value === "string") return typeof template === "string" ? value : new A.ImmutableString(value);
  if (Array.isArray(value)) {
    const like = Array.isArray(template) && template.length > 0 ? template[0] : undefined;
    return value.map((item) => fresh(item, like));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(value)) {
      if (x === undefined) continue;
      out[k] = fresh(x, isMap(template) ? template[k] : undefined);
    }
    return out;
  }
  return value;
}

function itemId(v: unknown): string | undefined {
  if (!isMap(v)) return undefined;
  const id = plain(v.id);
  return typeof id === "string" ? id : undefined;
}

function sameItem(a: unknown, b: unknown): boolean {
  const ia = itemId(a);
  const ib = itemId(b);
  if (ia !== undefined || ib !== undefined) return ia === ib;
  return same(a, b);
}

class Writer implements DraftEditor {
  private readonly doc: A.Doc<ManifestDocument>;

  constructor(doc: A.Doc<ManifestDocument>) {
    this.doc = doc;
  }

  set(pointer: string, value: unknown): void {
    const path = resolvePointer(this.doc, pointer);
    if (!path) return;
    if (path.length === 0) {
      this.reconcileMap(this.doc as unknown as Record<string, unknown>, [], value as Record<string, unknown>);
      return;
    }
    const parent = this.ensureParent(path);
    this.write(parent, path, value, undefined);
  }

  replace(pointer: string, value: unknown): void {
    const path = resolvePointer(this.doc, pointer);
    if (!path || path.length === 0) return;
    const parent = this.ensureParent(path);
    const key = path[path.length - 1];
    const current = (parent as Record<Prop, unknown>)[key];
    // A fresh assignment, so the key holds one value again; text stays text.
    (parent as Record<Prop, unknown>)[key] = fresh(value, current);
  }

  remove(pointer: string): void {
    const path = resolvePointer(this.doc, pointer);
    if (!path || path.length === 0) return;
    const parent = at(this.doc, path.slice(0, -1));
    const key = path[path.length - 1];
    if (Array.isArray(parent) && typeof key === "number") {
      if (key < parent.length) (parent as A.List<unknown>).deleteAt(key);
    } else if (isMap(parent)) {
      delete parent[key as string];
    }
  }

  /** The container that holds the last segment, creating maps on the way. */
  private ensureParent(path: Prop[]): Node {
    let node: Node = this.doc as unknown as Node;
    for (const p of path.slice(0, -1)) {
      let next = (node as Record<Prop, unknown>)[p];
      if (next === undefined || next === null || typeof next !== "object" || isScalarString(next)) {
        (node as Record<Prop, unknown>)[p] = {};
        next = (node as Record<Prop, unknown>)[p];
      }
      node = next as Node;
    }
    return node;
  }

  /** Brings parent[last of path] to value, writing only what differs. */
  private write(parent: Node, path: Prop[], value: unknown, template: Template): void {
    const key = path[path.length - 1];
    const slot = parent as Record<Prop, unknown>;
    const current = slot[key];
    if (value === undefined) {
      if (Array.isArray(parent) && typeof key === "number") {
        if (key < parent.length) (parent as A.List<unknown>).deleteAt(key);
      } else if (current !== undefined) {
        delete slot[key];
      }
      return;
    }
    if (typeof value === "string") {
      if (typeof current === "string") {
        if (current !== value) A.updateText(this.doc, path, value);
      } else if (isScalarString(current)) {
        if (current.val !== value) slot[key] = new A.ImmutableString(value);
      } else {
        const like = template ?? (Array.isArray(parent) ? parent.find((x) => x !== undefined) : undefined);
        slot[key] = fresh(value, like);
      }
      return;
    }
    if (Array.isArray(value)) {
      if (Array.isArray(current)) this.reconcileList(current, path, value);
      else slot[key] = fresh(value, template);
      return;
    }
    if (value !== null && typeof value === "object") {
      if (isMap(current)) this.reconcileMap(current, path, value as Record<string, unknown>, template);
      else slot[key] = fresh(value, template);
      return;
    }
    if (current !== value || isCounter(current)) slot[key] = value;
  }

  private reconcileMap(current: Record<string, unknown>, path: Prop[], next: Record<string, unknown>, template?: Template): void {
    for (const [k, v] of Object.entries(next)) {
      this.write(current, [...path, k], v, isMap(template) ? template[k] : undefined);
    }
    for (const k of Object.keys(current)) {
      if (!(k in next) || next[k] === undefined) delete current[k];
    }
  }

  /**
   * A list, matched item by item. The common head and tail are kept (by id
   * where items carry one), so an item somebody else is editing keeps its
   * identity; what is left in the middle is edited in place when both sides
   * have the same number of items, and spliced otherwise.
   */
  private reconcileList(current: unknown[], path: Prop[], next: unknown[]): void {
    let head = 0;
    while (head < current.length && head < next.length && sameItem(current[head], next[head])) head++;
    let tail = 0;
    while (
      tail < current.length - head &&
      tail < next.length - head &&
      sameItem(current[current.length - 1 - tail], next[next.length - 1 - tail])
    )
      tail++;
    // Items kept by identity may still differ inside.
    for (let i = 0; i < head; i++) this.writeItem(current, path, i, next[i]);
    for (let i = 0; i < tail; i++) {
      this.writeItem(current, path, current.length - 1 - i, next[next.length - 1 - i]);
    }
    const oldMiddle = current.length - head - tail;
    const newMiddle = next.length - head - tail;
    if (oldMiddle === newMiddle) {
      for (let i = 0; i < newMiddle; i++) this.writeItem(current, path, head + i, next[head + i]);
      return;
    }
    const like = current.find((x) => x !== undefined);
    if (oldMiddle > 0) (current as A.List<unknown>).deleteAt(head, oldMiddle);
    if (newMiddle > 0) {
      const added = next.slice(head, head + newMiddle).map((item) => fresh(item, like));
      (current as A.List<unknown>).insertAt(head, ...added);
    }
  }

  private writeItem(list: unknown[], path: Prop[], index: number, value: unknown): void {
    // Another item, for the shape of a field this one does not have yet.
    const template = list.find((x, i) => i !== index && x !== undefined);
    this.write(list, [...path, index], value, template);
  }
}

// ---------------------------------------------------------------------------
// Conflicts: a key written by two sessions at once keeps every value, and
// Automerge exposes them. One note per field, never a lost value.

function leaf(v: unknown): boolean {
  return v === null || typeof v !== "object" || isScalarString(v) || isCounter(v) || v instanceof Date;
}

function collectConflicts(node: unknown, path: Prop[], out: FieldConflict[]): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => visit(node, i, child, path, out));
  } else if (isMap(node)) {
    for (const [k, child] of Object.entries(node)) visit(node, k, child, path, out);
  }
}

function visit(parent: unknown, key: Prop, child: unknown, path: Prop[], out: FieldConflict[]): void {
  const here = [...path, key];
  const values = A.getConflicts(parent as A.Doc<unknown>, key);
  if (values && Object.keys(values).length > 1) {
    const all = Object.values(values);
    if (all.every(leaf)) {
      const value = plain(child);
      const others: unknown[] = [];
      let skipped = false;
      for (const v of all.map(plain)) {
        if (!skipped && same(v, value)) {
          skipped = true;
          continue;
        }
        if (!others.some((o) => same(o, v))) others.push(v);
      }
      if (others.length > 0) out.push({ path: formatPointer(here), value, others });
      return;
    }
  }
  collectConflicts(child, here, out);
}

// ---------------------------------------------------------------------------
// One shared draft.

class Draft implements SharedDraft {
  readonly kind: string;
  readonly id: string;
  private readonly handle: DocHandle<ManifestDocument>;
  private readonly onRelease: () => void;
  private cached?: { heads: string; doc: ManifestDocument };
  private changing = false;

  constructor(kind: string, id: string, handle: DocHandle<ManifestDocument>, onRelease: () => void) {
    this.kind = kind;
    this.id = id;
    this.handle = handle;
    this.onRelease = onRelease;
  }

  private raw(): A.Doc<ManifestDocument> {
    return this.handle.doc();
  }

  doc(): ManifestDocument {
    const raw = this.raw();
    const heads = A.getHeads(raw).join(",");
    if (this.cached?.heads !== heads) this.cached = { heads, doc: plain(raw) as ManifestDocument };
    return this.cached.doc;
  }

  change(fn: (edit: DraftEditor) => void): void {
    // The handle announces a change synchronously, inside this call, and
    // names every source "change"; this flag is what tells ours apart.
    this.changing = true;
    try {
      this.handle.change((d) => fn(new Writer(d)));
    } finally {
      this.changing = false;
    }
  }

  subscribe(listener: (change: DraftChange) => void): () => void {
    const on = ({ patchInfo }: { patchInfo: A.PatchInfo<ManifestDocument> }) =>
      listener({ local: this.changing, moved: (pointer, index) => moved(patchInfo, pointer, index) });
    this.handle.on("change", on);
    return () => {
      this.handle.off("change", on);
    };
  }

  isText(pointer: string): boolean {
    const raw = this.raw();
    const path = resolvePointer(raw, pointer);
    return path !== undefined && typeof at(raw, path) === "string";
  }

  conflicts(pointer = ""): FieldConflict[] {
    const out: FieldConflict[] = [];
    collectConflicts(this.raw(), [], out);
    return out.filter((c) => within(c.path, normalise(this.raw(), pointer)));
  }

  cursor(pointer: string, index: number): string | undefined {
    const raw = this.raw();
    const path = resolvePointer(raw, pointer);
    const text = path ? at(raw, path) : undefined;
    if (!path || typeof text !== "string") return undefined;
    try {
      return A.getCursor(raw, path, edge(text, index));
    } catch {
      return undefined;
    }
  }

  cursorPosition(pointer: string, cursor: string): number | undefined {
    const raw = this.raw();
    const path = resolvePointer(raw, pointer);
    if (!path || typeof at(raw, path) !== "string") return undefined;
    try {
      return A.getCursorPosition(raw, path, cursor);
    } catch {
      return undefined;
    }
  }

  release(): void {
    this.onRelease();
  }
}

/** A position as a cursor takes it: past the last character is the end,
 * which stays the end however much is typed there. */
function edge(text: string, index: number): Parameters<typeof A.getCursor>[2] {
  return index >= text.length ? "end" : Math.max(0, index);
}

/** An index in a text field, carried across one change by a cursor. */
function moved(info: A.PatchInfo<ManifestDocument>, pointer: string, index: number): number | undefined {
  const before = resolvePointer(info.before, pointer);
  const after = resolvePointer(info.after, pointer);
  if (!before || !after) return undefined;
  const text = at(info.before, before);
  if (typeof text !== "string" || typeof at(info.after, after) !== "string") return undefined;
  try {
    return A.getCursorPosition(info.after, after, A.getCursor(info.before, before, edge(text, index)));
  } catch {
    return undefined;
  }
}

/** A pointer with braced ids turned into indices, so it compares with the
 * index pointers conflicts are reported under. */
function normalise(root: unknown, pointer: string): string {
  if (!pointer.includes("{")) return pointer;
  const path = resolvePointer(root, pointer);
  return path ? formatPointer(path) : pointer;
}

// ---------------------------------------------------------------------------
// Presence on one document.

/** How often silent sessions are looked for. */
const SWEEP_MS = 250;

class Channel implements PresenceChannel {
  private readonly handle: DocHandle<unknown> | undefined;
  private readonly me: Sender;
  private readonly peers: PeerSet;
  private readonly listeners = new Set<(peers: Peer[]) => void>();
  private state: PresenceState;
  private heartbeat?: ReturnType<typeof setInterval>;
  private sweep?: ReturnType<typeof setInterval>;
  private pointerTimer?: ReturnType<typeof setTimeout>;
  private lastPointerSent = -Infinity;
  private closed = false;
  private readonly onMessage: (p: { message: unknown }) => void;
  private readonly onUnload: () => void;

  constructor(handle: DocHandle<unknown> | undefined, me: Sender, route: string | undefined) {
    this.handle = handle;
    this.me = me;
    this.peers = new PeerSet(me.session);
    this.state = route !== undefined ? { route } : {};
    this.onMessage = ({ message }) => {
      if (this.peers.receive(message, Date.now())) this.emit();
    };
    this.onUnload = () => this.close();
    if (!handle) return;
    handle.on("ephemeral-message", this.onMessage);
    this.heartbeat = setInterval(() => this.send(), HEARTBEAT_MS);
    this.sweep = setInterval(() => {
      if (this.peers.expire(Date.now())) this.emit();
    }, SWEEP_MS);
    if (typeof window !== "undefined") window.addEventListener("pagehide", this.onUnload);
    this.send();
  }

  publish(next: PresenceState): void {
    if (this.closed) return;
    const onlyPointer = Object.keys(next).every((k) => k === "pointer");
    this.state = { ...this.state, ...next };
    if (!onlyPointer) {
      this.send();
      return;
    }
    // The pointer, at most twenty times a second: the last position always
    // goes, a little late, rather than being dropped.
    const wait = this.lastPointerSent + POINTER_MS - Date.now();
    if (wait <= 0) {
      this.send();
    } else if (!this.pointerTimer) {
      this.pointerTimer = setTimeout(() => {
        this.pointerTimer = undefined;
        this.send();
      }, wait);
    }
  }

  subscribe(listener: (peers: Peer[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.peers.list());
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    if (this.closed) return;
    this.send(true);
    this.closed = true;
    clearInterval(this.heartbeat);
    clearInterval(this.sweep);
    clearTimeout(this.pointerTimer);
    this.handle?.off("ephemeral-message", this.onMessage);
    if (typeof window !== "undefined") window.removeEventListener("pagehide", this.onUnload);
    this.listeners.clear();
  }

  private send(leaving = false): void {
    if (this.closed || !this.handle) return;
    const now = Date.now();
    this.lastPointerSent = now;
    // A send carries everything, so it is a heartbeat too.
    try {
      this.handle.broadcast(messageFor(this.me, this.state, now, leaving));
    } catch {
      // A handle that is not ready yet drops this one; the heartbeat repeats it.
    }
  }

  private emit(): void {
    const list = this.peers.list();
    for (const l of this.listeners) l(list);
  }
}

// ---------------------------------------------------------------------------

/** The collaboration facet over one Repo. */
export function createLive(opts: LiveOptions): Live {
  const repo = new Repo({ network: opts.network, storage: opts.storage });
  const drafts = new Map<string, { draft: Promise<Draft>; holders: number }>();
  const findTimeout = opts.findTimeoutMs ?? 15_000;

  let status: ConnectionStatus = "connecting";
  const statusListeners = new Set<(s: ConnectionStatus) => void>();
  const connected = new Set<string>();
  function setStatus(next: ConnectionStatus) {
    if (next === status) return;
    status = next;
    for (const l of statusListeners) l(status);
  }
  repo.networkSubsystem.on("peer", ({ peerId }) => {
    connected.add(peerId);
    setStatus("online");
  });
  repo.networkSubsystem.on("peer-disconnected", ({ peerId }) => {
    connected.delete(peerId);
    if (connected.size === 0) setStatus("offline");
  });
  const grace = setTimeout(() => {
    if (status === "connecting") setStatus("offline");
  }, opts.connectGraceMs ?? 5000);

  let me: Promise<Sender> | undefined;
  function sender(): Promise<Sender> {
    me ??= opts.session().then(
      (s) => ({ session: newSession(), actor: s.actor, ...(s.name ? { name: s.name } : {}), color: colorFor(s.actor) }),
      () => {
        me = undefined;
        throw new Error("no session");
      },
    );
    return me;
  }

  async function find<T>(url: string): Promise<DocHandle<T>> {
    const signal = AbortSignal.timeout(findTimeout);
    return repo.find<T>(url as never, { signal });
  }

  async function locate(kind: string, id: string): Promise<string> {
    const key = `draft:${kind}/${id}`;
    try {
      const doc = await opts.locate(kind, id);
      opts.remember?.set(key, doc.url);
      return doc.url;
    } catch (e) {
      const known = opts.remember?.get(key);
      if (known) return known;
      throw e;
    }
  }

  return {
    repo,

    openDraft(kind, id) {
      const key = `${kind}/${id}`;
      let entry = drafts.get(key);
      if (!entry) {
        const draft = (async () => {
          const url = await locate(kind, id);
          const handle = await find<ManifestDocument>(url);
          return new Draft(kind, id, handle, () => {
            const e = drafts.get(key);
            if (!e) return;
            e.holders -= 1;
            if (e.holders <= 0) drafts.delete(key);
          });
        })();
        entry = { draft, holders: 0 };
        drafts.set(key, entry);
        draft.catch(() => {
          if (drafts.get(key) === entry) drafts.delete(key);
        });
      }
      entry.holders += 1;
      return entry.draft;
    },

    async joinPresence(screen) {
      const who = await sender();
      let handle: DocHandle<unknown> | undefined;
      try {
        const url = screen ? await locate(screen.kind, screen.id) : (await opts.presenceDocument()).url;
        handle = await find<unknown>(url);
      } catch {
        // No document to travel on (offline, or not found): a channel that
        // says nothing and hears nothing, so the screen works the same.
        handle = undefined;
      }
      return new Channel(handle, who, opts.route?.());
    },

    watchConnection(listener) {
      statusListeners.add(listener);
      listener(status);
      return () => {
        statusListeners.delete(listener);
      };
    },

    async shutdown() {
      clearTimeout(grace);
      await repo.shutdown();
    },
  };
}
