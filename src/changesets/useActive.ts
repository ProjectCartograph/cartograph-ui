import { useSyncExternalStore } from "react";

import { activeChangeSet } from "@/client/active";

/** The change set this window works in, as a hook that follows it. */
export function useActiveChangeSet(): string | undefined {
  return useSyncExternalStore(activeChangeSet.subscribe, activeChangeSet.get, () => undefined);
}
