// Shared drafts for tests: several sessions on one in-memory network, the
// way browsers are joined through the engine, each with its own Client. A
// component test builds on these without touching Automerge itself.

// The full entry point initialises the WebAssembly where a test runs; the
// facet uses /slim, which shares the one module.
import "@automerge/automerge";
import { ImmutableString } from "@automerge/automerge/slim";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";

import { fakeClient } from "./fake";
import { createLive, type Live } from "./live";
import type { Client } from "./port";

/** A manifest as the engine would create its document: the fields named in
 * `text` as collaborative text, every other string a scalar. */
function genesis(value: unknown, text: Set<string>, pointer = ""): unknown {
  if (typeof value === "string") return text.has(pointer) ? value : new ImmutableString(value);
  if (Array.isArray(value)) return value.map((v, i) => genesis(v, text, `${pointer}/${i}`));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, genesis(v, text, `${pointer}/${k}`)]));
  }
  return value;
}

export interface Sessions {
  lives: Live[];
  /** One Client per session: the given methods, plus the live ones. */
  clients: Client[];
  /** Ends every session. */
  close(): Promise<void>;
}

/**
 * `count` sessions sharing the drafts of `manifests` ("Kind/id" to the
 * manifest), joined in a line over message channels.
 */
export function sessions(
  count: number,
  manifests: Record<string, { manifest: Record<string, unknown>; text?: string[] }>,
  given: Partial<Client> = {},
): Sessions {
  const urls: Record<string, string> = {};
  const lives: Live[] = [];
  const ports: MessagePort[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i + 1 < count; i++) {
    const channel = new MessageChannel();
    ports[i].push(channel.port1);
    ports[i + 1].push(channel.port2);
  }
  for (let i = 0; i < count; i++) {
    lives.push(
      createLive({
        network: ports[i].map((p) => new MessageChannelNetworkAdapter(p)),
        locate: async (kind, id) => {
          const url = urls[`${kind}/${id}`];
          if (!url) throw new Error(`no draft for ${kind}/${id}`);
          return { documentId: url.replace(/^automerge:/, ""), url };
        },
        presenceDocument: async () => ({ documentId: "", url: urls.presence }),
        session: async () => ({ actor: `person-${i + 1}`, name: `Person ${i + 1}`, canWrite: true }),
        connectGraceMs: 60_000,
      }),
    );
  }
  for (const [key, { manifest, text }] of Object.entries(manifests)) {
    const handle = lives[0].repo.create(genesis(manifest, new Set(text ?? [])) as Record<string, unknown>);
    urls[key] = handle.url;
  }
  urls.presence = lives[0].repo.create({}).url;
  const clients = lives.map((live) =>
    fakeClient({
      ...given,
      openDraft: live.openDraft,
      joinPresence: live.joinPresence,
      watchConnection: live.watchConnection,
    }),
  );
  return {
    lives,
    clients,
    async close() {
      await Promise.all(lives.map((l) => l.shutdown()));
    },
  };
}
