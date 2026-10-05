import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { GoalTree } from "@/client/port";
import { copy } from "@/copy";
import { useGoalTree, useSettings } from "@/surfaces/goals/api";
import { levelName } from "@/surfaces/goals/levels";

const lc = copy.home.left;

/** One thing defined but not finished, and where it is finished. */
export interface LeftItem {
  key: string;
  name: string;
  why: string;
  to: "/strategy" | "/goals/$id";
  params?: { id: string };
}

type Node = GoalTree["nodes"][number];

/**
 * What the strategy was started with but not finished: the purpose
 * without its vision or mission, a goal without its aim, a goal with no
 * objectives under it, an objective with no outcomes, and anything not
 * placed yet. What opening a workspace leaves for later, read from the
 * tree as it stands, so it empties as the person finishes each.
 */
export function leftToDo(tree: GoalTree | undefined, purpose: { vision?: string; mission?: string } | undefined): LeftItem[] {
  const out: LeftItem[] = [];
  if (!tree) return out;
  const word = (l: string) => levelName(l, tree.levels);
  const anything = tree.nodes.length > 0 || (tree.unplaced ?? []).length > 0;
  if (anything && purpose && (!purpose.vision || !purpose.mission)) {
    out.push({ key: "purpose", name: lc.purpose, why: !purpose.vision ? lc.noVision : lc.noMission, to: "/strategy" });
  }
  const visit = (n: Node) => {
    const at = (why: string) => out.push({ key: `${n.id}:${why}`, name: n.name, why, to: "/goals/$id", params: { id: n.id } });
    if (!n.objective?.trim()) at(lc.noAim(word(n.level)));
    const below = (n.children ?? []).filter((c) => c.level !== n.level);
    if (n.level === "goal" && below.length === 0) at(lc.nothingUnder(word("objective")));
    if (n.level === "objective" && below.length === 0) at(lc.nothingUnder(word("outcome")));
    for (const c of n.children ?? []) visit(c);
  };
  for (const n of tree.nodes) visit(n);
  for (const n of tree.unplaced ?? []) {
    out.push({ key: `${n.id}:unplaced`, name: n.name, why: lc.unplaced, to: "/goals/$id", params: { id: n.id } });
    for (const c of n.children ?? []) visit(c);
  }
  return out;
}

/** What is left, as the tree and the purpose stand now. */
export function useLeftToDo(): LeftItem[] {
  const client = useClient();
  const tree = useGoalTree();
  const settings = useSettings();
  // The purpose as stated, its draft included; the settings' copy until
  // it is read.
  const purpose = useQuery({
    queryKey: ["purpose"],
    queryFn: async () => (await client.get("Purpose", "default")).manifest.spec as { vision?: string; mission?: string },
    retry: false,
  });
  return leftToDo(tree.data, purpose.data ?? settings.data?.purpose ?? undefined);
}
