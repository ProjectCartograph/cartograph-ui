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

/** Where the workspace stands, read from its records, so it is the same
 * for everyone and on every device: named (a purpose with an organisation
 * or a vision) and with goals (any in the tree, placed or not). */
function useWorkspaceState() {
  const client = useClient();
  return useQuery({
    queryKey: ["new-workspace"],
    queryFn: async () => {
      const [settings, tree] = await Promise.all([client.settings(), client.goalTree()]);
      const named = !!settings.purpose?.organisation || !!settings.purpose?.vision;
      const goals = tree.nodes.length > 0 || (tree.unplaced ?? []).length > 0;
      return { named, goals };
    },
    retry: false,
    staleTime: 60_000,
  }).data;
}

/**
 * Whether the workspace is new: no organisation named on its purpose and
 * not a goal in the tree, placed or not. Only then is the walk opened by
 * itself, so a workspace someone has started is never sent back to it.
 */
export function useNewWorkspace(): boolean | undefined {
  const s = useWorkspaceState();
  return s ? !s.named && !s.goals : undefined;
}

/**
 * Whether the workspace is set up: named, with goals, as the walk leaves
 * it. Until then the walk can be resumed from Home (#128), and once it is,
 * /welcome is closed (#127).
 */
export function useWorkspaceSetUp(): boolean | undefined {
  const s = useWorkspaceState();
  return s ? s.named && s.goals : undefined;
}
