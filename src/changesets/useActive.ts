import { useSyncExternalStore } from "react";

import { activeChangeSet } from "@/client/active";

/** Whether the person is looking at the record as it is, without the
 * change set they work in. */
export function useAsItIs(): boolean {
  return useSyncExternalStore(activeChangeSet.subscribe, activeChangeSet.asItIs, () => false);
}

/** The change set this window works in, as a hook that follows it. */
export function useActiveChangeSet(): string | undefined {
  return useSyncExternalStore(activeChangeSet.subscribe, activeChangeSet.get, () => undefined);
}
