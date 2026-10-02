import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { Role, Session } from "@/client/port";

/** The spec field naming the team that owns a manifest of each kind, as
 * the engine reads it (docs/adr/0011 in cartograph-engine). */
export const teamField: Record<string, string> = {
  Project: "team",
  Programme: "leadTeam",
  Operation: "team",
  DataSource: "team",
};

/** Every role, from the least to the most a role may do. */
export const roles: Role[] = ["reader", "contributor", "strategyEditor", "administrator"];

/** Who this interface acts as and what they may do. Asked once a minute;
 * the engine decides again on every write. */
export function useSession() {
  const client = useClient();
  return useQuery({ queryKey: ["session"], queryFn: () => client.session(), staleTime: 60_000 });
}

/** Whether the session may change a manifest of kind owned by team (none
 * for a new one, or a kind no team owns). Without an access list, the
 * session's canWrite decides. */
export function mayWrite(session: Session | undefined, kind: string, team?: string): boolean {
  if (!session) return true; // not known yet: offer, and let the engine decide
  const access = session.access;
  if (!access) return session.canWrite;
  switch (access.scopes[kind] ?? "none") {
    case "all":
      return true;
    case "teams":
      return !team || access.reach.includes(team);
    default:
      return false;
  }
}

/** Whether the session holds role. */
export function holds(session: Session | undefined, role: Role): boolean {
  return !!session?.access?.roles.includes(role);
}

/** The team that owns a manifest, read from its spec. */
export function owningTeam(kind: string, spec: unknown): string | undefined {
  const field = teamField[kind];
  if (!field || !spec || typeof spec !== "object") return undefined;
  const v = (spec as Record<string, unknown>)[field];
  return typeof v === "string" && v !== "" ? v : undefined;
}
