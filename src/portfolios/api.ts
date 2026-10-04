import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import { orUndefined } from "@/client/port";
import type { DecisionLine, HeldKind } from "./types";

export interface Held {
  kind: HeldKind;
  id: string;
  name: string;
}

/** What names a portfolio: its programmes, projects and portfolios, read
 * back from their own definitions (engine TAXONOMY.md D1, D32). */
export function useHeld(portfolioId: string) {
  const client = useClient();
  return useQuery({
    queryKey: ["portfolio-held", portfolioId],
    staleTime: 30_000,
    queryFn: async (): Promise<Held[]> => {
      const out: Held[] = [];
      for (const kind of ["Programme", "Project", "Portfolio"] as const) {
        const rows = ((await orUndefined(client.list(kind))) ?? []) as { id: string; name?: string }[];
        const loaded = await Promise.all(
          rows.map(async (row) => {
            const one = await orUndefined(client.get(kind, row.id));
            const spec = (one as unknown as { manifest?: { spec?: Record<string, unknown> } } | undefined)?.manifest?.spec ?? {};
            const named = kind === "Project" ? (spec.alignment as { portfolios?: string[] } | undefined)?.portfolios : (spec.portfolios as string[] | undefined);
            return (named ?? []).includes(portfolioId) ? { kind, id: row.id, name: row.name ?? row.id } : null;
          }),
        );
        for (const h of loaded) if (h) out.push(h);
      }
      return out;
    },
  });
}

/** The id of a portfolio's decisions file: one beside each portfolio. */
export const decisionsId = (portfolioId: string) => `${portfolioId}-decisions`;

/** The portfolio's decisions, as last saved; empty when none are. */
export function useDecisions(portfolioId: string) {
  const client = useClient();
  return useQuery({
    queryKey: ["portfolio-decisions", portfolioId],
    queryFn: async (): Promise<DecisionLine[]> => {
      const one = await orUndefined(client.get("PortfolioDecisions", decisionsId(portfolioId)));
      const spec = (one as unknown as { manifest?: { spec?: { decisions?: DecisionLine[] } } } | undefined)?.manifest?.spec;
      return spec?.decisions ?? [];
    },
  });
}

/** A portfolio's advisory checks, in the programme's shape. */
export function usePortfolioChecks(portfolioId: string) {
  const client = useClient();
  return useQuery({ queryKey: ["portfolio-checks", portfolioId], queryFn: () => client.checks("Portfolio", portfolioId) });
}
