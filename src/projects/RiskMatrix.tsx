import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copy } from "@/copy";
import type { ImpactLikelihood, Risk } from "./types";

const rc = copy.projects.risks;

/** Impact reads bottom to top, likelihood left to right, so the worst
 * corner is top right the way every risk matrix is drawn. */
const LEVELS: ImpactLikelihood[] = ["low", "medium", "high"];
const RANK: Record<ImpactLikelihood, number> = { low: 1, medium: 2, high: 3 };

export type Severity = 1 | 2 | 3 | 4;

/**
 * Where a cell sits on the matrix, as one of four levels.
 *
 * The product of the two ranks, banded: 1 is the calm corner, 4 is only
 * high impact and high likelihood together. Derived from position, so
 * the grid always looks the same and the counts on it are what change.
 */
export function severityOf(impact: ImpactLikelihood, likelihood: ImpactLikelihood): Severity {
  const product = RANK[impact] * RANK[likelihood];
  if (product >= 9) return 4;
  if (product >= 6) return 3;
  if (product >= 3) return 2;
  return 1;
}

const FILL: Record<Severity, string> = {
  1: "bg-severity-1 text-severity-1-fg",
  2: "bg-severity-2 text-severity-2-fg",
  3: "bg-severity-3 text-severity-3-fg",
  4: "bg-severity-4 text-severity-4-fg",
};

/**
 * The risk matrix, as a heat map.
 *
 * The fill is a sequential ramp over severity, which is a magnitude, so
 * it is one hue light to dark. That hue is no hue: this theme's own
 * chart tokens are achromatic and its only chromatic token is
 * destructive, which is kept for escalation, a state rather than a
 * magnitude. The theme's chart ramp carries the same five greys in both
 * modes, so the steps here are chosen per surface instead of flipped,
 * fifteen units of OKLab lightness apart so adjacent levels can actually
 * be told apart.
 *
 * Never colour alone: every cell carries its count as a number and its
 * severity as a word in the tooltip, and the axes are labelled.
 */
export function RiskMatrix({
  risks,
  selected,
  onPlace,
}: {
  risks: Risk[];
  /** The risk being placed, if the person picked one to move. */
  selected?: number | null;
  onPlace?: (impact: ImpactLikelihood, likelihood: ImpactLikelihood) => void;
}) {
  const cells = useMemo(() => {
    const out = new Map<string, Risk[]>();
    for (const r of risks) {
      if (!r.impact || !r.likelihood) continue;
      const key = `${r.impact}-${r.likelihood}`;
      out.set(key, [...(out.get(key) ?? []), r]);
    }
    return out;
  }, [risks]);

  const unplaced = risks.filter((r) => !r.impact || !r.likelihood).length;

  return (
    <div className="flex flex-col gap-2" data-slot="risk-matrix">
      <div className="flex items-stretch gap-2">
        {/* The impact axis, read up the side. A grid of the same three
            rows as the cells, so each label sits against its own row
            rather than being spread between the ends. */}
        <div className="grid grid-rows-3 gap-1">
          {[...LEVELS].reverse().map((l) => (
            <span
              key={l}
              className="flex h-16 items-center justify-end text-[11px] text-muted-foreground"
            >
              {rc.levels[l]}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-3 gap-1">
            {[...LEVELS].reverse().map((impact) =>
              LEVELS.map((likelihood) => {
                const here = cells.get(`${impact}-${likelihood}`) ?? [];
                const severity = severityOf(impact, likelihood);
                const escalated = here.filter((r) => r.escalate?.flag).length;
                const placing = selected !== null && selected !== undefined;
                return (
                  <Tooltip key={`${impact}-${likelihood}`}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        data-slot="risk-cell"
                        data-severity={severity}
                        data-count={here.length}
                        disabled={!placing}
                        onClick={() => onPlace?.(impact, likelihood)}
                        aria-label={rc.cellLabel(
                          rc.severity[severity],
                          rc.levels[impact],
                          rc.levels[likelihood],
                          here.length,
                        )}
                        className={`relative flex h-16 w-24 items-center justify-center rounded-md text-sm transition-[outline] outline-offset-2 ${FILL[severity]} ${
                          placing ? "cursor-pointer hover:outline-2 hover:outline-ring" : "cursor-default"
                        }`}
                      >
                        {here.length > 0 ? (
                          <span className="text-base font-medium tabular-nums">{here.length}</span>
                        ) : null}
                        {/* Escalation is a state, so it gets the theme's one
                            chromatic token and a mark, never a fill. */}
                        {escalated > 0 ? (
                          <TriangleAlert
                            className="absolute top-1 right-1 size-3.5 text-destructive"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      <p className="font-medium">{rc.severity[severity]}</p>
                      <p className="text-xs">
                        {rc.gridImpact} {rc.levels[impact].toLowerCase()}, {rc.gridLikelihood.toLowerCase()}{" "}
                        {rc.levels[likelihood].toLowerCase()}
                      </p>
                      {here.length === 0 ? (
                        <p className="text-xs">{rc.cellEmpty}</p>
                      ) : (
                        <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                          {here.slice(0, 4).map((r, i) => (
                            <li key={r.id ?? i} className="truncate">
                              {r.description || rc.unnamed}
                            </li>
                          ))}
                          {here.length > 4 ? <li>{rc.andMore(here.length - 4)}</li> : null}
                        </ul>
                      )}
                      {escalated > 0 ? <p className="mt-1 text-xs">{rc.escalatedHere(escalated)}</p> : null}
                    </TooltipContent>
                  </Tooltip>
                );
              }),
            )}
          </div>
          {/* The likelihood axis, read along the bottom. */}
          <div className="grid grid-cols-3 gap-1">
            {LEVELS.map((l) => (
              <span key={l} className="text-center text-[11px] text-muted-foreground">
                {rc.levels[l]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {rc.gridImpact} &uarr; &middot; {rc.gridLikelihood} &rarr;
        </span>
        {/* A legend, because a fill alone never carries identity. */}
        <span className="flex items-center gap-1.5">
          {([1, 2, 3, 4] as Severity[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span aria-hidden="true" className={`size-2.5 rounded-xs ${FILL[s]}`} />
              {rc.severity[s]}
            </span>
          ))}
        </span>
        {unplaced > 0 ? <span>{rc.unplaced(unplaced)}</span> : null}
      </div>
    </div>
  );
}
