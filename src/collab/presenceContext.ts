import { createContext, useContext } from "react";

import type { Peer, PresenceState, SharedDraft } from "@/client/port";

export interface PresenceApi {
  /** The other sessions on this screen. */
  peers: Peer[];
  /** The screen's draft, when it has one: carets are cursors into it. */
  draft?: SharedDraft;
  publish: (state: PresenceState) => void;
}

const quiet: PresenceApi = { peers: [], publish: () => {} };
export const PresenceContext = createContext<PresenceApi>(quiet);

/** The other sessions on this screen; none outside a provider. */
export function usePresence(): PresenceApi {
  return useContext(PresenceContext);
}
