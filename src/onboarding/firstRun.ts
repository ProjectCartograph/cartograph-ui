import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";

// Whether this browser has been through opening the workspace, or put it
// off. A convenience only: losing it means being offered the walk again,
// and the walk is only offered on a workspace with nothing in it.
const KEY = "cartograph:onboarded";

export function onboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Without storage the walk is offered again; nothing else is lost.
  }
}

/**
 * Whether the workspace is new: no organisation named on its purpose and
 * not a goal in the tree, placed or not. Only then is the walk offered,
 * so a workspace someone has started is never sent back to the start.
 */
export function useNewWorkspace(): boolean | undefined {
  const client = useClient();
  const q = useQuery({
    queryKey: ["new-workspace"],
    queryFn: async () => {
      const [settings, tree] = await Promise.all([client.settings(), client.goalTree()]);
      const named = !!settings.purpose?.organisation || !!settings.purpose?.vision;
      return !named && tree.nodes.length === 0 && (tree.unplaced ?? []).length === 0;
    },
    retry: false,
    staleTime: 60_000,
  });
  return q.data;
}
