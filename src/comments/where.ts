import type { Comment } from "@/client/port";
import { manifestLink } from "@/proposals/links";

/** The step of a project's walk a part of it is answered in. */
const STEP_OF: Record<string, string> = { deliverables: "deliverables", risks: "risks", milestones: "timeline", costs: "costs", resources: "resources", data: "data", objectives: "measures" };

/** Where a comment is answered: the step of a project's walk it is beside,
 * else the record. */
export function whereOf(c: Comment): { to: string; params: Record<string, string> } {
  if (c.kind === "Project") {
    const section = c.anchor.startsWith("section:") ? c.anchor.slice("section:".length) : STEP_OF[c.anchor.split("/")[2] ?? ""];
    if (section) return { to: `/projects/$id/initiation/${section}`, params: { id: c.manifest } };
  }
  return manifestLink({ kind: c.kind, manifestId: c.manifest } as never);
}

const SEEN = "cartograph.mentionsSeen";

/** When this browser last opened its mentions; a convenience, so a lost
 * value only shows every mention as new again. */
export const mentionsSeen = {
  get(): number {
    try {
      return Number(window.localStorage.getItem(SEEN) ?? 0) || 0;
    } catch {
      return 0;
    }
  },
  now(): void {
    try {
      window.localStorage.setItem(SEEN, String(Date.now()));
    } catch {
      // Not kept; the count stays as it is.
    }
  },
};
