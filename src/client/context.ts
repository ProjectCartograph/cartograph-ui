import { createContext, createElement, useContext, type ReactNode } from "react";

import type { Client } from "./port";

const ClientContext = createContext<Client | null>(null);

/** Hands every component below it the one Client: the HTTP adapter in the
 * app (main.tsx), a fake in a test. */
export function ClientProvider({ client, children }: { client: Client; children?: ReactNode }) {
  return createElement(ClientContext.Provider, { value: client }, children);
}

/** The Client this component works through. */
export function useClient(): Client {
  const client = useContext(ClientContext);
  // No default: a component rendered without a provider would otherwise
  // reach for a server nobody gave it.
  if (!client) throw new Error("useClient: no ClientProvider above this component");
  return client;
}
