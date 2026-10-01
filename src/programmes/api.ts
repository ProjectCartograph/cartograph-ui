import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import { orUndefined } from "@/client/port";

export interface MemberSummary {
  kind: "Project" | "Operation";
  id: string;
  name: string;
  goals: string[];
  namesThisProgramme: boolean;
  /** The project this one is a component of, if any (TAXONOMY.md D15). */
  parent?: string;
}

/**
 * What is inside a programme, read back rather than stored.
 *
 * A programme coordinates the work inside it, and the work is what
 * declares that: a project names its programmes, an operation names its
 * programmes, and this reads those declarations back (TAXONOMY.md D1).
 * Nothing is written on the programme, so there is one place to change a
 * membership and no pair to keep in step.
 *
 * Also returns the work that shares a goal with this programme without
 * naming it — the candidates for "should this be in here?" — which is why
 * every project's and operation's goals come back too.
 */
export function useProgrammeMembers(programmeId: string, enabled = true) {
  const client = useClient();
  return useQuery({
    queryKey: ["programme-members", programmeId],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<MemberSummary[]> => {
      const out: MemberSummary[] = [];
      for (const kind of ["Project", "Operation"] as const) {
        const list = await orUndefined(client.list(kind));
        if (!list) continue;
        const rows = list as {
          id: string;
          name?: string;
        }[];
        const loaded = await Promise.all(
          rows.map(async (row) => {
            const one = await orUndefined(client.get(kind, row.id));
            if (!one) return null;
            const spec = (one as unknown as { manifest?: { spec?: Record<string, unknown> } })
              .manifest?.spec;
            if (!spec) return null;
            const programmes =
              kind === "Project"
                ? ((spec.alignment as { programmes?: string[] } | undefined)?.programmes ?? [])
                : ((spec.programmes as string[] | undefined) ?? []);
            const goals =
              kind === "Project"
                ? ((spec.alignment as { goals?: string[] } | undefined)?.goals ?? [])
                : [];
            return {
              kind,
              id: row.id,
              name: row.name ?? row.id,
              goals,
              namesThisProgramme: programmes.includes(programmeId),
              parent:
                kind === "Project"
                  ? (spec.alignment as { partOf?: string } | undefined)?.partOf
                  : undefined,
            } satisfies MemberSummary;
          }),
        );
        for (const m of loaded) if (m) out.push(m);
      }
      return out;
    },
  });
}

/**
 * A programme's advisory checks. Every one of them reads other manifests —
 * the work that names this programme, the goals it aligns to, the
 * dependency graph — so none of them blocks, and the list is flat rather
 * than counted by state the way a project's is.
 */
export function useProgrammeChecks(programmeId: string, enabled = true) {
  const client = useClient();
  return useQuery({
    queryKey: ["programme-checks", programmeId],
    enabled,
    queryFn: () => client.checks("Programme", programmeId),
  });
}
