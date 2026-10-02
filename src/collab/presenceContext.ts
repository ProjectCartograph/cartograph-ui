import { createContext, useContext } from "react";

import type { Peer, PresenceState, SharedDraft } from "@/client/port";

export interface PresenceApi {
  /** The other sessions on this screen's document: on a manifest, everyone
   * on any of its sections. */
  peers: Peer[];
  /** Those on the very view in front of this person, the only ones whose
   * pointer, caret and focus are drawn. Undefined means all of peers. */
  here?: Peer[];
  /** The screen's draft, when it has one: carets are cursors into it. */
  draft?: SharedDraft;
  publish: (state: PresenceState) => void;
}

const quiet: PresenceApi = { peers: [], publish: () => {} };
export const PresenceContext = createContext<PresenceApi>(quiet);

/** The sessions on the view in front of this person. */
export function peersHere(p: PresenceApi): Peer[] {
  return p.here ?? p.peers;
}

/** The other sessions on this screen; none outside a provider. */
export function usePresence(): PresenceApi {
  return useContext(PresenceContext);
}
