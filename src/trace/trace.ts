// The people's trace (engine docs/adr/0034): what only the interface sees
// a person do, by its shape, sent to the engine for
// docs/EVALUATING_PEOPLE.md. Nothing is built or sent unless the session
// says the deployment keeps the trace; then acts are batched and sent
// every few seconds, and when the page hides. An act never carries what
// a person wrote: its fields are a route pattern, a kind, a record's id,
// a step's key and a field's JSON pointer, each checked here against the
// same alphabet the engine holds them to, and left out when they do not
// fit rather than risk the batch.

import { NotFound, type Client, type InterfaceEvent } from "@/client/port";

/** An act as a component gives it: the time and the screen are added. */
export type Act = Omit<InterfaceEvent, "at"> & { surface?: string };

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const SURFACE = /^[A-Za-z0-9_$./-]{0,120}$/;
const POINTER = /^(\/([A-Za-z0-9_.-]+|\{[A-Za-z0-9_.:-]+\}|-))*$/;

/** The act with every field that does not fit its alphabet left out. */
export function shaped(e: InterfaceEvent): InterfaceEvent {
  const out: InterfaceEvent = { ...e };
  for (const k of ["kind", "record", "step", "changeSet"] as const) {
    const v = out[k];
    if (v !== undefined && !TOKEN.test(v)) delete out[k];
  }
  if (out.surface !== undefined && !SURFACE.test(out.surface)) delete out.surface;
  if (out.field !== undefined && (out.field.length > 200 || !POINTER.test(out.field))) delete out.field;
  if (out.millis !== undefined) out.millis = Math.max(0, Math.min(Math.round(out.millis), 3_600_000));
  return out;
}

export interface TraceOptions {
  /** The window's session: random, fixed for the life of the tab. */
  session: string;
  /** How long acts wait before they are sent. */
  flushMs?: number;
  /** The most acts in one batch (the engine takes 500). */
  maxBatch?: number;
  now?: () => Date;
  /** The screen the person is on, as its route pattern. */
  surface?: () => string;
}

export class PeopleTrace {
  private on = false;
  private queue: InterfaceEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly flushMs: number;
  private readonly maxBatch: number;
  private readonly now: () => Date;
  private readonly client: Client;
  private readonly opts: TraceOptions;
  surface: () => string;

  constructor(client: Client, opts: TraceOptions) {
    this.client = client;
    this.opts = opts;
    this.flushMs = opts.flushMs ?? 5000;
    this.maxBatch = opts.maxBatch ?? 200;
    this.now = opts.now ?? (() => new Date());
    this.surface = opts.surface ?? (() => "");
  }

  /** Asks the session whether to record at all. */
  async start(): Promise<boolean> {
    try {
      this.on = (await this.client.session()).traceOn === true;
    } catch {
      this.on = false;
    }
    return this.on;
  }

  get enabled(): boolean {
    return this.on;
  }

  /** Keeps an act for the next batch; nothing at all while the trace is off. */
  act(a: Act): void {
    if (!this.on) return;
    const { surface, ...rest } = a;
    this.queue.push(shaped({ ...rest, surface: surface ?? this.surface(), at: this.now().toISOString() }));
    if (this.queue.length >= this.maxBatch) {
      void this.flush();
    } else if (!this.timer) {
      // A timer only while acts wait: an idle page costs nothing.
      this.timer = setTimeout(() => void this.flush(), this.flushMs);
    }
  }

  /** Sends what waits. A 404 means the deployment turned the trace off. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    while (this.on && this.queue.length > 0) {
      const events = this.queue.splice(0, this.maxBatch);
      try {
        await this.client.recordEvents({ session: this.opts.session, interface: "web", events });
      } catch (err) {
        // A trace never gets in a person's way: a refused or failed batch
        // is dropped, and a server that keeps no trace is not asked again.
        if (err instanceof NotFound) {
          this.on = false;
          this.queue = [];
        }
        return;
      }
    }
  }
}
