// The collaboration facet as the browser runs it: one Repo for the app,
// joined to the engine's sync socket and keeping every document in
// IndexedDB, so an edit made with no connection survives a reload and
// syncs when the connection returns.
//
// Loaded on first use (http.ts imports it dynamically), so Automerge stays
// out of the first download and arrives once the first screen has drawn
// and joins presence. The WebAssembly is
// initialised from its own asset URL, the way Automerge documents for
// Vite: the /slim entry points and initializeWasm, with no bundler plugin.

import { initializeWasm, isWasmInitialized } from "@automerge/automerge/slim";
import wasmUrl from "@automerge/automerge/automerge.wasm?url";
import { WebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

import { createLive, type Live, type LiveOptions } from "./live";

/** The sync socket for an API base: ws or wss, as the page was served. */
export function syncURL(apiBase: string, where: Location = window.location): string {
  const base = new URL(apiBase, where.href);
  const protocol = where.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${base.host}${base.pathname.replace(/\/$/, "")}/sync`;
}

function remembered(): LiveOptions["remember"] {
  return {
    get(key) {
      try {
        return window.localStorage.getItem(`cartograph:${key}`) ?? undefined;
      } catch {
        return undefined;
      }
    },
    set(key, url) {
      try {
        window.localStorage.setItem(`cartograph:${key}`, url);
      } catch {
        // A private window keeps nothing; the draft still opens online.
      }
    },
  };
}

/** The app's one Repo, made on first use. */
export async function browserLive(
  apiBase: string,
  port: Pick<LiveOptions, "locate" | "presenceDocument" | "session">,
): Promise<Live> {
  if (!isWasmInitialized()) await initializeWasm(wasmUrl);
  return createLive({
    ...port,
    network: [new WebSocketClientAdapter(syncURL(apiBase))],
    storage: typeof indexedDB === "undefined" ? undefined : new IndexedDBStorageAdapter("cartograph"),
    remember: remembered(),
    route: () => window.location.pathname,
  });
}
