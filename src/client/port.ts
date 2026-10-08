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
export type LinkKind = Schemas["LinkKind"];
export type LinkCandidate = Schemas["LinkCandidate"];
export type ComponentGraph = Schemas["ComponentGraph"];
export type StructureQuestion = Schemas["StructureQuestion"];
export type Lineage = Schemas["Lineage"];
export type LineageNode = Schemas["LineageNode"];
export type ComponentNode = Schemas["ComponentNode"];
export type WorkRef = Schemas["WorkRef"];
export type ScheduleItem = Schemas["ScheduleItem"];
export type Graph = Schemas["Graph"];
export type GraphNode = Schemas["GraphNode"];
export type GraphEdge = Schemas["GraphEdge"];
export type Order = Schemas["Order"];
export type OrderStage = Schemas["OrderStage"];
export type GlossaryEntry = Schemas["GlossaryEntry"];
export type Understanding = Schemas["Understanding"];
export type Match = Schemas["Match"];
export type Relevance = Schemas["Relevance"];
export type IdeaReading = Schemas["IdeaReading"];
export type DecisionModel = Schemas["DecisionModel"];
export type GoalCheck = Schemas["GoalCheck"];
export type ProgrammeCheck = Schemas["ProgrammeCheck"];
export type ProjectChecks = Schemas["ProjectChecks"];
export type ProjectState = Schemas["ProjectState"];
export type ProjectStateName = Schemas["ProjectStateName"];
export type GapCoverage = Schemas["GapCoverage"];
export type CyclePeriod = Schemas["CyclePeriod"];
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
/** Something an agent proposed for its person to accept or decline
 * (engine docs/adr/0016). */
export type Proposal = Schemas["Proposal"];
export type ProposalReview = Schemas["ProposalReview"];
export type ChangeSet = Schemas["ChangeSet"];
export type ChangeSetReview = Schemas["ChangeSetReview"];
export type ChangeSetItem = Schemas["ChangeSetItem"];
export type ChangeSetStatus = ChangeSet["status"];
export type ProposalPart = Schemas["ProposalPart"];
export type Guide = Schemas["Guide"];
export type GuideField = Schemas["GuideField"];
export type ManifestCheck = Schemas["ManifestCheck"];
export type AgentGrant = Schemas["AgentGrant"];
export type AgentToken = Schemas["AgentToken"];
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
  /** The change set this session works in; set by the client as it sends. */
  changeSet?: string;
  focus?: PresenceFocus | null;
  caret?: PresenceCaret | null;
  pointer?: PresencePointer | null;
}

/** Another session on the same screen, as its last message said. */
/** What an agent did last, as the engine announces it for the agent
 * (presence schema, agent; engine docs/adr/0018). */
export interface PresenceAgent {
  /** The person it acts for, as proposals name them. */
  for: string;
  /** Counts its steps, so each is shown once. */
  seq: number;
  step: "guide" | "read" | "draft" | "checks" | "propose";
  kind?: string;
  id?: string;
  name?: string;
  fields?: string[];
  met?: number;
  open?: number;
  proposal?: string;
  parts?: number;
  /** The change set the step was in (engine docs/adr/0022). */
  changeSet?: string;
}

export interface Peer {
  session: string;
  actor: string;
  name?: string;
  color: string;
  route?: string;
  /** Present when the session is an agent. */
  agent?: PresenceAgent;
  /** The change set the session works in, if any. */
  changeSet?: string;
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
  checks(kind: "Programme" | "Portfolio" | "Operation" | "Gap", id: string): Promise<ProgrammeCheck[]>;

  // What the engine derives across manifests.
  /** Every goal, objective and outcome as one tree. */
  goalTree(): Promise<GoalTree>;
  /** Every element of the workspace and every reference between them,
   * placed by the engine; with focus (Kind/id), each node's distance from
   * that one. */
  graph(focus?: string): Promise<Graph>;
  /** The order of work (TAXONOMY.md D28): each stage of the strategy, how
   * far the workspace has got, and which to write now. */
  order(): Promise<Order>;
  /** Every word of the taxonomy, defined plainly with an example, in the
   * order of work (TAXONOMY.md D29). */
  glossary(): Promise<GlossaryEntry[]>;
  /** What a typed text reads as, by the glossary, and which existing
   * records say the same; without a decision model, matches by words
   * only (engine docs/adr/0023). */
  understand(text: string): Promise<Understanding>;
  /** What in the workspace is relevant to a piece of work: the likeliest
   * few records of each kind (engine docs/adr/0023). */
  relevant(text: string, kinds?: string[], level?: string): Promise<Relevance>;
  /** The sentence of a rough idea that answers each question a walk
   * asks, where a decision model is sure (engine docs/adr/0023). */
  fromIdea(kind: string, idea: string): Promise<IdeaReading>;
  /** Whether a decision model is configured and answering now. */
  decisionModel(): Promise<DecisionModel>;
  /** The existing records of a kind that say what a text says. */
  match(kind: string, text: string, level?: string): Promise<Match[]>;
  /** Which part of a gap each piece of work addresses. */
  gapCoverage(id: string): Promise<GapCoverage>;
  /** A reporting cycle's periods that overlap two months (YYYY-MM), as
   * the engine derives them: keyed by the month each ends, with its label
   * and the day its reading is due (TAXONOMY.md D40). */
  cyclePeriods(id: string, from: string, to: string): Promise<CyclePeriod[]>;
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
  /** Listens, without being seen, to the feed a person's agents announce
   * their steps on: the caller's own, or, for an administrator, one
   * person's (engine docs/adr/0018). */
  followAgents(person?: string): Promise<PresenceChannel>;
  /** How the sync connection stands, now and on every change. Returns the
   * unsubscribe. */
  watchConnection(listener: (status: ConnectionStatus) => void): () => void;

  // The access list (docs/adr/0011). Only an administrator reads or
  // changes it; NotFound where the deployment keeps none.
  /** Everyone who may sign in. */
  people(): Promise<Person[]>;
  /** Lists a person by their address, if they are not listed, and sets the
   * roles and teams an administrator grants them. */
  grantPerson(email: string, grant: { roles: Role[]; teams: string[]; agentsOff?: boolean }): Promise<Person>;
  /** Takes a person off the access list. */
  removePerson(email: string): Promise<void>;

  // What agents proposed (engine docs/adr/0016). An agent reads and
  // drafts; what would make the record waits for its person.
  /** The caller's open proposals, or, with a manifest, every open
   * proposal on it. */
  proposals(on?: { kind: string; id: string }): Promise<Proposal[]>;
  /** One proposal as its person reviews it: what it would change, field
   * by field, and the checks on what it proposes. */
  getProposal(id: string): Promise<ProposalReview>;
  /** Change sets (engine docs/adr/0022): the person's own and their
   * agents', newest first; everyone's for an administrator who asks. */
  changeSets(opts?: { status?: ChangeSetStatus; everyone?: boolean }): Promise<ChangeSet[]>;
  /** A change set as its person reviews it. */
  /** What a link of this kind may join from the record from (and, for a
   * project's problem, that problem, by id or "#n"), each allowed or not
   * with the reason (engine docs/UI_CONTRACT.md "Drawing a link"). */
  linkCandidates(link: LinkKind, from: string, problem?: string): Promise<LinkCandidate[]>;
  /** Every project and programme, what each depends on, every loop, the
   * critical path and how much work depends on each (engine TAXONOMY.md
   * D46). */
  components(): Promise<ComponentGraph>;
  /** The questions that decide what a piece of work is (engine TAXONOMY.md D56). */
  structureQuestions(): Promise<StructureQuestion[]>;
  /** A project's data lineage from its data as being edited: where it
   * comes from and what reads what it produces, placed by the engine. */
  lineage(project: string, name: string, uses: string[], produces: string[]): Promise<Lineage>;
  /** A project's milestones placed on time (engine TAXONOMY.md D48). */
  schedule(project: string): Promise<ScheduleItem[]>;
  changeSet(id: string): Promise<ChangeSetReview>;
  /** Include an item in the next acceptance, or trim it from it. */
  includeChangeSetItem(set: string, kind: string, id: string, included: boolean): Promise<void>;
  /** Accept a proposed change set as its person: whole, after trimming. */
  acceptChangeSet(set: string, reason?: string): Promise<ChangeSet>;
  /** Take a proposed change set back to work, asking for changes. */
  reopenChangeSet(set: string, reason?: string): Promise<ChangeSet>;
  /** End a change set without saving it. */
  closeChangeSet(set: string, reason?: string): Promise<ChangeSet>;
  /** Start a change set: a piece of work, named, that every edit made
   * while it is active goes into (engine docs/adr/0024). */
  startChangeSet(title: string, description?: string): Promise<ChangeSet>;
  /** Rename a change set, or say what it is for. */
  retitleChangeSet(set: string, title: string, description?: string): Promise<ChangeSet>;
  /** Put a change set up for review, with checks left open waived for a
   * reason where the person gives one. */
  /** Proposes a change set; openChecks leaves each named check open with
   * its reason, by Kind/id then check id. */
  proposeChangeSet(set: string, reason?: string, openChecks?: Record<string, Record<string, string>>): Promise<ChangeSet>;
  /** Drop one record from a change set, as if it had never been changed
   * there. */
  dropChangeSetItem(set: string, kind: string, id: string): Promise<void>;
  /** Makes the record a proposal proposed, as the caller. Conflict when
   * it was decided already or its manifest changed since. */
  acceptProposal(id: string, reason?: string): Promise<Proposal>;
  /** Declines a proposal. */
  declineProposal(id: string, reason?: string): Promise<Proposal>;

  // The agents people let act for them (engine docs/adr/0016).
  /** The caller's own, or, for an administrator, one person's or
   * everyone's ("*"). Empty where the deployment's own stack authorizes
   * agents. */
  agentGrants(person?: string): Promise<AgentGrant[]>;
  /** How to define a kind well, for one level, in one language: what
   * each field asks for with right and wrong examples, and the words an
   * editor may offer. The same guide agents read. */
  getGuide(kind: string, opts?: { level?: string; locale?: string }): Promise<Guide>;
  /** The address an agent's MCP client connects to, absolute. */
  mcpAddress(): string;
  /** Lets an agent act for the caller by a token to paste into it, shown
   * once. NotFound where Cartograph does not authorize agents. */
  createAgentToken(label: string, days?: number): Promise<AgentToken>;
  /** Disconnects an agent at once. */
  revokeAgentGrant(id: string): Promise<void>;
}
