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
}
