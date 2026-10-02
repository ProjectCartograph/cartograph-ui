// The port this interface works with Cartograph through: the TypeScript
// side of pkg/client.Client in cartograph-engine (docs/UI_CONTRACT.md,
// section 2). Code depends on this and never on a path. The HTTP adapter
// in ./http.ts is the one place a path appears; a test hands a component
// a fake through the same ClientProvider.
//
// Every type here comes from the generated contract types, so a change to
// the contract shows up as a type error rather than as a wrong screen.

import type { components } from "@/api/gen/schema";

type Schemas = components["schemas"];

export type Problem = Schemas["Problem"];
export type Summary = Schemas["Summary"];
export type Manifest = Schemas["Manifest"];
export type ManifestView = Schemas["ManifestView"];
export type Version = Schemas["Version"];
export type References = Schemas["References"];
export type KindCount = Schemas["KindCount"];
export type Settings = Schemas["Settings"];
export type GoalTree = Schemas["GoalTree"];
export type GoalCheck = Schemas["GoalCheck"];
export type ProgrammeCheck = Schemas["ProgrammeCheck"];
export type ProjectChecks = Schemas["ProjectChecks"];
export type ProjectState = Schemas["ProjectState"];
export type ProjectStateName = Schemas["ProjectStateName"];
export type GapCoverage = Schemas["GapCoverage"];
export type Vault = Schemas["Vault"];
export type ManifestRef = Schemas["ManifestRef"];
export type Exclusion = Schemas["Exclusion"];
export type SnapshotList = Schemas["SnapshotList"];
export type SharedDocument = Schemas["SharedDocument"];
export type Session = Schemas["Session"];
/** What the access list gives the session's principal (docs/adr/0011 in
 * cartograph-engine), when the deployment keeps one. */
export type SessionAccess = Schemas["SessionAccess"];
/** One entry on the access list: someone who may sign in, never a manifest. */
export type Person = Schemas["Person"];
/** A role on the access list. */
export type Role = Schemas["Role"];
/** A kind's JSON Schema, as the contract types it. */
export type KindSchema = Record<string, never>;

/** The filters a listing takes. */
export interface ListQuery {
  /** A case-insensitive substring of the id or the name. */
  q?: string;
  /** "Kind/id" references a manifest must make, every one of them. */
  ref?: string[];
  /** "spec" carries each manifest's spec on its summary. */
  expand?: "spec";
}

/** A manifest, as the shared draft holds it: plain JSON. */
export type ManifestDocument = Record<string, unknown>;

/**
 * How the sync connection stands. "connecting" until the engine first
 * answers; "offline" once it has gone, while edits keep landing on this
 * device.
 */
export type ConnectionStatus = "connecting" | "online" | "offline";

/**
 * One edit to a shared draft, by JSON pointer (the control's
 * data-cartograph-field). Every method writes only what differs, so two
 * people editing different fields of one item never touch each other's.
 */
export interface DraftEditor {
  /** Brings the value at path to `value`. A field the document holds as
   * text is spliced character by character; anything else is assigned. An
   * object or a list is walked, so only the leaves that differ change. */
  set(path: string, value: unknown): void;
  /** Writes value over whatever the field holds, in one assignment. This
   * is what settles a conflict: the field holds one value again. */
  replace(path: string, value: unknown): void;
  /** Removes a key or a list item. */
  remove(path: string): void;
}

/** What changed, as a subscriber hears it. */
export interface DraftChange {
  /** False when the change arrived from someone else (or from storage). */
  local: boolean;
  /** Where a position in a text field before this change sits after it,
   * following its character; undefined for a field that is not text. */
  moved(path: string, index: number): number | undefined;
}

/** A field written by two sessions at once: the value the document shows
 * and every other value written concurrently, any of which can be put back. */
export interface FieldConflict {
  path: string;
  value: unknown;
  others: unknown[];
}

/**
 * A manifest's shared draft between versions (docs/adr/0007): one
 * Automerge document, kept on this device and synced with everyone who has
 * it open. Components see plain JSON and JSON pointers, never Automerge.
 */
export interface SharedDraft {
  readonly kind: string;
  readonly id: string;
  /** The manifest as the draft holds it now. */
  doc(): ManifestDocument;
  /** One edit, applied at once and synced. */
  change(fn: (edit: DraftEditor) => void): void;
  /** Every change from now on, local or remote. Returns the unsubscribe. */
  subscribe(listener: (change: DraftChange) => void): () => void;
  /** Whether the document holds the field at path as collaborative text. */
  isText(path: string): boolean;
  /** Every field under path (all of the draft when omitted) that two
   * sessions wrote at once. */
  conflicts(path?: string): FieldConflict[];
  /** A stable position in a text field that follows its character while
   * others type; undefined when the field is not text. */
  cursor(path: string, index: number): string | undefined;
  /** Where a cursor from `cursor` sits now. */
  cursorPosition(path: string, cursor: string): number | undefined;
  /** Gives the draft back; the last holder closes it. */
  release(): void;
}

/** A field being edited, a selection in it and the pointer, as one
 * session publishes them (contract/schemas/presence.schema.json). */
export interface PresenceFocus {
  path: string;
}
export interface PresenceCaret {
  path: string;
  anchor: string;
  head: string;
}
export interface PresencePointer {
  target: string;
  x: number;
  y: number;
}

/** What a screen publishes about itself; each call merges into the last. */
export interface PresenceState {
  route?: string;
  focus?: PresenceFocus | null;
  caret?: PresenceCaret | null;
  pointer?: PresencePointer | null;
}

/** Another session on the same screen, as its last message said. */
export interface Peer {
  session: string;
  actor: string;
  name?: string;
  color: string;
  route?: string;
  focus: PresenceFocus | null;
  caret: PresenceCaret | null;
  pointer: PresencePointer | null;
  /** When this was last heard, by this device's clock. */
  heard: number;
}

/**
 * Presence on one screen's document: what this session publishes and the
 * live set of the others. Relayed, never stored; a session nobody has heard
 * from for ten seconds drops out, and one that closes says so.
 */
export interface PresenceChannel {
  publish(state: PresenceState): void;
  /** The other sessions, now and on every change. Returns the unsubscribe. */
  subscribe(listener: (peers: Peer[]) => void): () => void;
  /** Says leaving and stops. */
  close(): void;
}

/** Which document a screen's presence travels on: a manifest's own, or
 * the engine's presence document for every screen that is not one. */
export type PresenceScreen = { kind: string; id: string } | null;

/** The kinds that have a charter the engine renders. */
export type CharterKind = "Project" | "Programme" | "Operation";

export interface CharterOptions {
  /** Render the working copy rather than the last version (projects). */
  working?: boolean;
}

/**
 * The engine answered, and the answer was no. Carries the status it
 * answered with and the problems it named, so a caller can land them on
 * their fields with the server's own message. A transport that could not
 * reach the engine at all throws something else.
 */
export class ClientError extends Error {
  readonly status: number;
  readonly problems: Problem[];

  constructor(status: number, problems: Problem[], message = `engine answered ${status}`) {
    super(message);
    this.name = "ClientError";
    this.status = status;
    this.problems = problems;
  }
}

/** A validating write the engine refused (422): the problems, landed on
 * their fields. A normal outcome to show, not a failure. pkg/client.Refused. */
export class Refused extends ClientError {
  constructor(problems: Problem[]) {
    super(422, problems, "refused");
    this.name = "Refused";
  }
}

/** The file changed under the write, or the base version is stale (409). */
export class Conflict extends ClientError {
  constructor(problems: Problem[] = []) {
    super(409, problems, "conflict");
    this.name = "Conflict";
  }
}

/** Nothing there (404). pkg/client.ErrNotFound. */
/** The engine's policy refused the action (403); the problem says why. */
export class Forbidden extends ClientError {
  constructor(problems: Problem[] = []) {
    super(403, problems, "forbidden");
    this.name = "Forbidden";
  }
}

export class NotFound extends ClientError {
  constructor(problems: Problem[] = []) {
    super(404, problems, "not found");
    this.name = "NotFound";
  }
}

/**
 * The answer, or undefined where the engine answered with an error. For a
 * read whose absence is an ordinary state (a map nobody has scored, a
 * name that has not loaded). A transport failure still throws.
 */
export async function orUndefined<T>(answer: Promise<T>): Promise<T | undefined> {
  try {
    return await answer;
  } catch (e) {
    if (e instanceof ClientError) return undefined;
    throw e;
  }
}

/**
 * The whole port, as far as this interface uses it. Names follow
 * pkg/client.Client where one exists. A refused write throws Refused, a
 * stale one Conflict, a missing manifest NotFound; any other error status
 * throws ClientError.
 */
export interface Client {
  // The contract: what an interface renders from.
  /** Every registered kind, with how many manifests each holds. */
  kinds(): Promise<KindCount[]>;
  /** A kind's JSON Schema. */
  schema(kind: string): Promise<KindSchema>;
  /** The organisation's words and defaults. */
  settings(): Promise<Settings>;

  // Manifests.
  /** One row per manifest of a kind, every page of it. */
  list(kind: string, query?: ListQuery): Promise<Summary[]>;
  /** A manifest as it reads now: the working copy when there is one. */
  get(kind: string, id: string): Promise<ManifestView>;
  /** Every saved version of a manifest. */
  versions(kind: string, id: string): Promise<Version[]>;
  /** What else a manifest names, and what names it. */
  references(kind: string, id: string): Promise<References>;
  /** Writes the working copy, the text as it should be saved. Never
   * validates, so half-finished work is never refused. */
  saveWorking(kind: string, id: string, text: string): Promise<void>;
  /** Throws the working copy away; get then answers with the last version. */
  discardWorking(kind: string, id: string): Promise<void>;
  /** The validating write: a document as its text, or as an object, saved
   * as a new version. Throws Refused or Conflict. */
  saveVersion(kind: string, id: string, doc: string | object, reason: string): Promise<Version>;
  /** Promotes the working copy to a new version. Throws Refused. */
  snapshot(kind: string, id: string, reason: string): Promise<Version>;
  /** A manifest's checks, in the shape its kind answers with. */
  checks(kind: "Project", id: string): Promise<ProjectChecks>;
  checks(kind: "Goal", id: string): Promise<GoalCheck[]>;
  checks(kind: "Programme" | "Operation" | "Gap", id: string): Promise<ProgrammeCheck[]>;

  // What the engine derives across manifests.
  /** Every goal, objective and outcome as one tree. */
  goalTree(): Promise<GoalTree>;
  /** Which part of a gap each piece of work addresses. */
  gapCoverage(id: string): Promise<GapCoverage>;
  /** Deletes a goal nothing references. Throws Refused naming what does. */
  deleteGoal(id: string, reason: string): Promise<void>;

  // A project's state.
  projectState(id: string): Promise<ProjectState>;
  /** Moves a project to another state. Throws Refused. */
  transition(id: string, to: ProjectStateName, reason?: string): Promise<ProjectState>;

  // The vault: what is live, what is held back, what was removed.
  vault(): Promise<Vault>;
  unapplied(): Promise<ManifestRef[]>;
  excluded(): Promise<Exclusion[]>;
  /** Includes "Kind/id" references, all in one write. */
  apply(refs: string[]): Promise<Vault>;
  /** Restores one removed "Kind/id" reference. */
  recover(ref: string): Promise<Vault>;
  /** Every saved version across the vault, a page at a time. */
  snapshots(page: { limit?: number; cursor?: string }): Promise<SnapshotList>;

  // The charter the engine renders.
  /** The charter as HTML. */
  charter(kind: CharterKind, id: string, opts?: CharterOptions): Promise<string>;
  /** Where a browser opens or downloads the charter. */
  charterLink(kind: CharterKind, id: string, format: "html" | "pdf", opts?: CharterOptions): string;

  // Working together (docs/adr/0007).
  /** Who this interface acts as, and whether it may write. */
  session(): Promise<Session>;
  /** The id of a manifest's shared draft. */
  sharedDocument(kind: string, id: string): Promise<SharedDocument>;
  /** The id of the document presence travels on away from a manifest. */
  presenceDocument(): Promise<SharedDocument>;
  /** Opens a manifest's shared draft, from this device when it has one
   * and over the sync socket otherwise. Throws when neither has it. Two
   * opens of one manifest share one draft; each releases its own. */
  openDraft(kind: string, id: string): Promise<SharedDraft>;
  /** Joins presence on a screen's document. */
  joinPresence(screen: PresenceScreen): Promise<PresenceChannel>;
  /** How the sync connection stands, now and on every change. Returns the
   * unsubscribe. */
  watchConnection(listener: (status: ConnectionStatus) => void): () => void;

  // The access list (docs/adr/0011). Only an administrator reads or
  // changes it; NotFound where the deployment keeps none.
  /** Everyone who may sign in. */
  people(): Promise<Person[]>;
  /** Lists a person by their address, if they are not listed, and sets the
   * roles and teams an administrator grants them. */
  grantPerson(email: string, grant: { roles: Role[]; teams: string[] }): Promise<Person>;
  /** Takes a person off the access list. */
  removePerson(email: string): Promise<void>;
}
