// The HTTP adapter behind the Client port: the contract's paths, through
// openapi-fetch over the types generated from contract/openapi.yaml. This
// is the one file in the interface where a path appears; `just wire`
// fails a path, a fetch or an openapi-fetch import anywhere else.

import createClient from "openapi-fetch";

import { copy } from "@/copy";
import { activeChangeSet } from "./active";

import type { paths } from "@/api/gen/schema";
import {
  ClientError,
  Conflict,
  Forbidden,
  NotFound,
  Refused,
  type CharterKind,
  type CharterOptions,
  type Client,
  type Version,
  type KindSchema,
  type Problem,
} from "./port";
import type { Live } from "./live";

/** Where the API sits: the SPA is always served by the same binary as the
 * API, under /api/v1. */
export const API_BASE = "/api/v1";

/** The error a status answers with, carrying the problems its body named. */
function errorFor(status: number, body: unknown): ClientError {
  const listed = (body as { problems?: unknown } | null | undefined)?.problems;
  const problems = Array.isArray(listed) ? (listed as Problem[]) : [];
  switch (status) {
    case 403:
      return new Forbidden(problems);
    case 404:
      return new NotFound(problems);
    case 409:
      return new Conflict(problems);
    case 422:
      return new Refused(problems);
    default:
      return new ClientError(status, problems);
  }
}

interface Answer<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** The body of a successful answer; an error status throws. */
async function answer<T>(call: Promise<Answer<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) throw errorFor(response.status, error);
  return data as T;
}

/** An answer with no body; an error status throws. */
async function done(call: Promise<Answer<unknown>>): Promise<void> {
  await answer(call);
}

/** Pass `fetch` to run the adapter against something other than the
 * browser's own (a test's). */
export function httpClient(
  opts: { baseUrl?: string; fetch?: (input: Request) => Promise<Response> } = {},
): Client {
  const baseUrl = opts.baseUrl ?? API_BASE;
  const wire = createClient<paths>({ baseUrl, ...(opts.fetch ? { fetch: opts.fetch } : {}) });

  function checks(kind: string, id: string) {
    const params = { params: { path: { id }, query: preview() } };
    switch (kind) {
      case "Project":
        return answer(wire.GET("/manifests/Project/{id}/checks", params));
      case "Goal":
        return answer(wire.GET("/manifests/Goal/{id}/checks", params));
      case "Programme":
        return answer(wire.GET("/manifests/Programme/{id}/checks", params));
      case "Portfolio":
        return answer(wire.GET("/manifests/Portfolio/{id}/checks", params));
      case "Operation":
        return answer(wire.GET("/manifests/Operation/{id}/checks", params));
      case "Gap":
        return answer(wire.GET("/manifests/Gap/{id}/checks", params));
      default:
        return Promise.reject(new NotFound([{ path: "", message: `no checks for ${kind}` }]));
    }
  }

  function charterHTML(kind: CharterKind, id: string, working: boolean) {
    const path = { path: { id } };
    switch (kind) {
      case "Project":
        return answer(
          wire.GET("/manifests/Project/{id}/charter.html", {
            params: { ...path, query: working ? { working } : undefined },
            parseAs: "text",
          }),
        );
      case "Programme":
        return answer(wire.GET("/manifests/Programme/{id}/charter.html", { params: path, parseAs: "text" }));
      case "Operation":
        return answer(wire.GET("/manifests/Operation/{id}/charter.html", { params: path, parseAs: "text" }));
    }
  }

  // The change set this window works in (engine docs/adr/0024): reads see
  // the workspace as if it were rolled in, drafts are its live drafts,
  // and every write lands in it, starting one on the first edit.
  const preview = () => {
    const set = activeChangeSet.get();
    return set ? { changeSet: set } : {};
  };
  async function workingSet(kind: string, id: string): Promise<string> {
    const set = activeChangeSet.get();
    if (set) return set;
    const started = await answer(wire.POST("/changesets", { body: { title: copy.workingIn.untitled(kind, id) } }));
    activeChangeSet.set(started.id);
    return started.id;
  }
  const putItem = (set: string, kind: string, id: string, yaml: string) =>
    done(wire.PUT("/changesets/{set}/items/{kind}/{id}", { params: { path: { set, kind, id } }, body: { yaml } }));
  // What a save into a change set answers: no new version (draft), the
  // record as it stands until the change set is rolled in.
  const inChangeSet = (kind: string, id: string, reason: string): Version => ({
    kind,
    id,
    number: 0,
    actor: "",
    reason,
    on: new Date().toISOString(),
    draft: true,
  });

  const session = () => answer(wire.GET("/session"));
  const sharedDocument = (kind: string, id: string) => {
    const set = activeChangeSet.get();
    return set
      ? answer(wire.GET("/changesets/{set}/items/{kind}/{id}/document", { params: { path: { set, kind, id } } }))
      : answer(wire.GET("/manifests/{kind}/{id}/document", { params: { path: { kind, id } } }));
  };
  const presenceDocument = () => answer(wire.GET("/presence"));
  const agentFeed = (person?: string) => answer(wire.GET("/agents/feed", { params: { query: person ? { person } : {} } }));

  // The collaboration side, made once and on first use: Automerge and its
  // WebAssembly load when a screen first asks for a draft or presence, not
  // with the first download.
  let live: Promise<Live> | undefined;
  function collaboration(): Promise<Live> {
    live ??= import("./browser-live").then((m) =>
      m.browserLive(baseUrl, { locate: sharedDocument, presenceDocument, agentFeed, session }),
    );
    return live;
  }
  // Listeners asked for before the Repo exists are joined to it once it does.
  function watchConnection(listener: (status: "connecting" | "online" | "offline") => void) {
    let stop: (() => void) | undefined;
    let stopped = false;
    listener("connecting");
    void collaboration().then((l) => {
      if (!stopped) stop = l.watchConnection(listener);
    });
    return () => {
      stopped = true;
      stop?.();
    };
  }

  return {
    session,
    sharedDocument,
    presenceDocument,
    openDraft: async (kind, id) => (await collaboration()).openDraft(kind, id),
    joinPresence: async (screen) => (await collaboration()).joinPresence(screen),
    followAgents: async (person) => (await collaboration()).followAgents(person),
    watchConnection,

    kinds: () => answer(wire.GET("/kinds")),
    schema: (kind) =>
      answer<KindSchema>(wire.GET("/schemas/{kind}", { params: { path: { kind } } })),
    settings: () => answer(wire.GET("/settings")),

    // Neither limit nor cursor is passed, so the engine answers with the
    // bare array; the envelope is unwrapped all the same in case it does not.
    list: async (kind, query) => {
      const data = await answer(
        wire.GET("/manifests/{kind}", {
          params: {
            path: { kind },
            query: query
              ? {
                  ...preview(),
                  ...(query.q ? { q: query.q } : {}),
                  ...(query.ref?.length ? { ref: query.ref } : {}),
                  ...(query.expand ? { expand: query.expand } : {}),
                }
              : preview(),
          },
        }),
      );
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
    get: (kind, id) => answer(wire.GET("/manifests/{kind}/{id}", { params: { path: { kind, id }, query: preview() } })),
    versions: (kind, id) =>
      answer(wire.GET("/manifests/{kind}/{id}/versions", { params: { path: { kind, id } } })),
    references: (kind, id) =>
      answer(wire.GET("/manifests/{kind}/{id}/references", { params: { path: { kind, id } } })),
    saveWorking: async (kind, id, text) => putItem(await workingSet(kind, id), kind, id, text),
    // Leaving a change set's draft drops it from the change set; with none
    // active there is nothing of the person's own to discard.
    discardWorking: async (kind, id) => {
      const set = activeChangeSet.get();
      if (set) await done(wire.DELETE("/changesets/{set}/items/{kind}/{id}", { params: { path: { set, kind, id } } }));
    },
    // A JSON manifest is YAML too, so it goes in as text.
    saveVersion: async (kind, id, doc, reason) => {
      await putItem(await workingSet(kind, id), kind, id, typeof doc === "string" ? doc : JSON.stringify(doc));
      return inChangeSet(kind, id, reason);
    },
    // A snapshot is the record as the change set holds it; one it does not
    // hold yet starts from the record.
    snapshot: async (kind, id, reason) => {
      const set = await workingSet(kind, id);
      const draft = await answer(wire.GET("/changesets/{set}/items/{kind}/{id}", { params: { path: { set, kind, id } } }));
      if (!draft.inChangeSet) await putItem(set, kind, id, draft.yaml);
      return inChangeSet(kind, id, reason);
    },
    checks: checks as Client["checks"],

    goalTree: () => answer(wire.GET("/goals/tree", { params: { query: preview() } })),
    graph: (focus) => answer(wire.GET("/graph", { params: { query: { ...preview(), ...(focus ? { focus } : {}) } } })),
    order: () => answer(wire.GET("/order", { params: { query: preview() } })),
    glossary: () => answer(wire.GET("/glossary", { params: { query: {} } })),
    understand: (text) => answer(wire.POST("/understand", { body: { text } })),
    relevant: (text, kinds, level) => answer(wire.POST("/relevant", { body: { text, ...(kinds ? { kinds } : {}), ...(level ? { level } : {}) } })),
    decisionModel: () => answer(wire.GET("/decision-model")),
    fromIdea: (kind, idea) => answer(wire.POST("/from-idea", { body: { kind, idea } })),
    match: (kind, text, level) => answer(wire.POST("/match", { body: { kind, text, ...(level ? { level } : {}) } })),
    gapCoverage: (id) => answer(wire.GET("/manifests/Gap/{id}/coverage", { params: { path: { id } } })),
    cyclePeriods: (id, from, to) =>
      answer(wire.GET("/manifests/ReportingCycle/{id}/periods", { params: { path: { id }, query: { from, to } } })),
    deleteGoal: async (id) => {
      const set = await workingSet("Goal", id);
      await done(wire.PUT("/changesets/{set}/items/{kind}/{id}/removal", { params: { path: { set, kind: "Goal", id } } }));
    },

    projectState: (id) => answer(wire.GET("/manifests/Project/{id}/state", { params: { path: { id } } })),
    // The move lands in the change set; the project stays where it is
    // until the change set is rolled in.
    transition: async (id, to) => {
      const set = await workingSet("Project", id);
      await done(wire.PUT("/changesets/{set}/items/Project/{id}/state", { params: { path: { set, id } }, body: { state: to } }));
      return answer(wire.GET("/manifests/Project/{id}/state", { params: { path: { id } } }));
    },

    vault: () => answer(wire.GET("/vault")),
    unapplied: async () => {
      const data = await answer(wire.GET("/vault/unapplied"));
      return Array.isArray(data) ? data : [];
    },
    excluded: () => answer(wire.GET("/vault/excluded")),
    apply: (refs) => answer(wire.POST("/vault/apply", { body: { refs } })),
    recover: (ref) => answer(wire.POST("/vault/recover", { body: { ref } })),
    people: async () => (await answer(wire.GET("/access/people"))).people,
    grantPerson: (email, grant) =>
      answer(wire.PUT("/access/people/{email}", { params: { path: { email } }, body: grant })),
    removePerson: (email) => done(wire.DELETE("/access/people/{email}", { params: { path: { email } } })),
    proposals: async (on) => {
      const data = await answer(wire.GET("/proposals", { params: { query: on ? { kind: on.kind, id: on.id } : {} } }));
      return Array.isArray(data) ? data : [];
    },
    getGuide: (kind, opts) =>
      answer(wire.GET("/guides/{kind}", { params: { path: { kind }, query: { level: opts?.level || undefined, locale: opts?.locale || undefined } } })),
    getProposal: (id) => answer(wire.GET("/proposals/{proposal}", { params: { path: { proposal: id } } })),
    changeSets: (opts) =>
      answer(wire.GET("/changesets", { params: { query: { ...(opts?.status ? { status: opts.status } : {}), ...(opts?.everyone ? { everyone: true } : {}) } } })),
    changeSet: (id) => answer(wire.GET("/changesets/{set}", { params: { path: { set: id } } })),
    includeChangeSetItem: async (set, kind, id, included) => {
      await answer(wire.PATCH("/changesets/{set}/items/{kind}/{id}", { params: { path: { set, kind, id } }, body: { included } }));
    },
    acceptChangeSet: (set, reason) => answer(wire.POST("/changesets/{set}/accept", { params: { path: { set } }, body: reason ? { reason } : {} })),
    reopenChangeSet: (set, reason) => answer(wire.POST("/changesets/{set}/reopen", { params: { path: { set } }, body: reason ? { reason } : {} })),
    closeChangeSet: (set, reason) => answer(wire.POST("/changesets/{set}/close", { params: { path: { set } }, body: reason ? { reason } : {} })),
    startChangeSet: (title, description) => answer(wire.POST("/changesets", { body: { title, ...(description ? { description } : {}) } })),
    retitleChangeSet: (set, title, description) =>
      answer(wire.PATCH("/changesets/{set}", { params: { path: { set } }, body: { title, ...(description ? { description } : {}) } })),
    proposeChangeSet: (set, reason) => answer(wire.POST("/changesets/{set}/propose", { params: { path: { set } }, body: reason ? { reason } : {} })),
    dropChangeSetItem: (set, kind, id) => done(wire.DELETE("/changesets/{set}/items/{kind}/{id}", { params: { path: { set, kind, id } } })),
    acceptProposal: (id, reason) =>
      answer(wire.POST("/proposals/{proposal}/accept", { params: { path: { proposal: id } }, body: reason ? { reason } : {} })),
    declineProposal: (id, reason) =>
      answer(wire.POST("/proposals/{proposal}/decline", { params: { path: { proposal: id } }, body: reason ? { reason } : {} })),
    agentGrants: async (person) => {
      const data = await answer(wire.GET("/agents", { params: { query: person ? { person } : {} } }));
      return Array.isArray(data) ? data : [];
    },
    mcpAddress: () => new URL(`${baseUrl}/mcp`, window.location.origin).toString(),
    createAgentToken: (label, days) => answer(wire.POST("/agents", { body: days ? { label, days } : { label } })),
    revokeAgentGrant: (id) => done(wire.DELETE("/agents/{grant}", { params: { path: { grant: id } } })),
    snapshots: (page) =>
      answer(
        wire.GET("/snapshots", {
          params: { query: { limit: page.limit, cursor: page.cursor || undefined } },
        }),
      ),

    charter: (kind, id, opts?: CharterOptions) => charterHTML(kind, id, !!opts?.working),
    charterLink: (kind, id, format, opts?: CharterOptions) =>
      `${baseUrl}/manifests/${kind}/${encodeURIComponent(id)}/charter.${format}` +
      (opts?.working ? "?working=true" : ""),
  };
}
