// The HTTP adapter behind the Client port: the contract's paths, through
// openapi-fetch over the types generated from contract/openapi.yaml. This
// is the one file in the interface where a path appears; `just wire`
// fails a path, a fetch or an openapi-fetch import anywhere else.

import createClient from "openapi-fetch";

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
    const params = { params: { path: { id } } };
    switch (kind) {
      case "Project":
        return answer(wire.GET("/manifests/Project/{id}/checks", params));
      case "Goal":
        return answer(wire.GET("/manifests/Goal/{id}/checks", params));
      case "Programme":
        return answer(wire.GET("/manifests/Programme/{id}/checks", params));
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

  const session = () => answer(wire.GET("/session"));
  const sharedDocument = (kind: string, id: string) =>
    answer(wire.GET("/manifests/{kind}/{id}/document", { params: { path: { kind, id } } }));
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
                  ...(query.q ? { q: query.q } : {}),
                  ...(query.ref?.length ? { ref: query.ref } : {}),
                  ...(query.expand ? { expand: query.expand } : {}),
                }
              : undefined,
          },
        }),
      );
      return Array.isArray(data) ? data : (data?.items ?? []);
    },
    get: (kind, id) => answer(wire.GET("/manifests/{kind}/{id}", { params: { path: { kind, id } } })),
    versions: (kind, id) =>
      answer(wire.GET("/manifests/{kind}/{id}/versions", { params: { path: { kind, id } } })),
    references: (kind, id) =>
      answer(wire.GET("/manifests/{kind}/{id}/references", { params: { path: { kind, id } } })),
    saveWorking: (kind, id, text) =>
      done(
        wire.PUT("/manifests/{kind}/{id}/working", {
          params: { path: { kind, id } },
          body: { yaml: text },
        }),
      ),
    discardWorking: (kind, id) =>
      done(wire.DELETE("/manifests/{kind}/{id}/working", { params: { path: { kind, id } } })),
    // The text when there is one: a manifest sent as JSON is decoded into
    // a Go map on the way in and written back out sorted.
    saveVersion: (kind, id, doc, reason) =>
      answer(
        wire.PUT("/manifests/{kind}/{id}", {
          params: { path: { kind, id } },
          // WriteRequest.manifest is "an object" in the contract, which the
          // generator can only type as an empty one; the engine validates
          // the real shape against the kind's JSON Schema.
          body:
            typeof doc === "string"
              ? { yaml: doc, reason }
              : { manifest: doc as Record<string, never>, reason },
        }),
      ),
    snapshot: (kind, id, reason) =>
      answer(
        wire.POST("/manifests/{kind}/{id}/snapshots", {
          params: { path: { kind, id } },
          body: { reason },
        }),
      ),
    checks: checks as Client["checks"],

    goalTree: () => answer(wire.GET("/goals/tree")),
    graph: (focus) => answer(wire.GET("/graph", { params: { query: focus ? { focus } : {} } })),
    order: () => answer(wire.GET("/order")),
    glossary: () => answer(wire.GET("/glossary", { params: { query: {} } })),
    gapCoverage: (id) => answer(wire.GET("/manifests/Gap/{id}/coverage", { params: { path: { id } } })),
    deleteGoal: (id, reason) =>
      done(wire.DELETE("/manifests/Goal/{id}", { params: { path: { id } }, body: { reason } })),

    projectState: (id) => answer(wire.GET("/manifests/Project/{id}/state", { params: { path: { id } } })),
    transition: (id, to, reason) =>
      answer(
        wire.POST("/manifests/Project/{id}/state", {
          params: { path: { id } },
          body: reason === undefined ? { to } : { to, reason },
        }),
      ),

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
