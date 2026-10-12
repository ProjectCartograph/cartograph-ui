import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";

import { useClient } from "@/client/context";
import type { ConstraintSide, TripleConstraint } from "@/client/port";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { copy } from "@/copy";
import { useProjectStore } from "../store";
import type { Constraint, InitiationSection, Risk } from "../types";
import { bearsOnOf } from "./triangle";

const tc = copy.projects.triangle;
const rc = copy.projects.risks;
const pc = copy.projects;


/** The step a risk on a side is raised in: on a deliverable, the
 * deliverables; on the scope as a whole, the scope. */
function stepFor(side: Constraint, on: string | undefined, deliverables: ReadonlySet<string>): InitiationSection {
  if (side === "schedule") return "timeline";
  if (side === "cost") return "resources";
  return on && deliverables.has(on) ? "deliverables" : "scope";
}

/**
 * The risks step as the overview of the triple constraint (engine
 * TAXONOMY.md D60): the triangle as the engine weighs it, each corner
 * sized by its share of the weighted risk, drawn by its stance and ringed
 * when most constrained, every mark said in words; then each side's risks
 * with a way to the step each bears on, and the risks on no side yet.
 */
export function TriangleOverview() {
  const store = useProjectStore();
  const client = useClient();
  const spec = store.spec;
  // Read again whenever what it is worked out from changes.
  const key = JSON.stringify({ r: spec.risks ?? [], c: spec.constraints ?? {}, m: (spec.milestones ?? []).map((m) => m.id) });
  const { data } = useQuery({
    queryKey: ["constraints", store.id, key],
    queryFn: () => client.constraints(store.id),
    enabled: store.loaded,
    placeholderData: (previous) => previous,
  });
  if (!data) return null;
  const byId = new Map((spec.risks ?? []).map((r) => [r.id ?? "", r] as const));
  const bears = bearsOnOf(spec);
  const names = new Map([...bears.scope, ...bears.schedule, ...bears.cost].map((i) => [i.id, i.name] as const));
  const deliverables = new Set(bears.scope.map((i) => i.id));
  const said = data.sides.some((s) => s.stance || s.risks.length > 0);
  if (!said && (data.unplaced ?? []).length === 0) return null;

  return (
    <section className="flex flex-col gap-4" data-cartograph-region="triangle-overview">
      <div>
        <h3 className="text-sm font-medium">{tc.overviewHeading}</h3>
        <p className="text-sm text-muted-foreground text-pretty">{tc.overviewLead}</p>
      </div>
      <div className="flex flex-col gap-4">
        <TriangleDrawing data={data} />
        <div className="flex flex-col gap-4">
          {data.sides.map((s) => (
            <SideList key={s.constraint} side={s} most={data.mostConstrained === s.constraint} byId={byId} names={names} deliverables={deliverables} id={store.id} />
          ))}
          {(data.unplaced ?? []).length > 0 ? (
            <div className="flex flex-col gap-1" data-cartograph-region="triangle-unplaced">
              <h4 className="text-sm font-medium">{tc.unplacedHeading}</h4>
              <p className="text-xs text-muted-foreground">{tc.unplacedLead}</p>
              <ul className="flex flex-col gap-0.5 text-sm">
                {data.unplaced!.map((id) => (
                  <li key={id}>{byId.get(id)?.description || rc.unnamed}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * The triangle at a glance, beside each section's risks (#59): which side
 * carries most of the weighted risk, read where the side is decided
 * rather than only on the risks step.
 */
export function MiniTriangle() {
  const store = useProjectStore();
  const client = useClient();
  const spec = store.spec;
  const key = JSON.stringify({ r: spec.risks ?? [], c: spec.constraints ?? {}, m: (spec.milestones ?? []).map((m) => m.id) });
  const { data } = useQuery({
    queryKey: ["constraints", store.id, key],
    queryFn: () => client.constraints(store.id),
    enabled: store.loaded,
    placeholderData: (previous) => previous,
  });
  if (!data || !data.sides.some((s) => s.risks.length > 0)) return null;
  return <TriangleDrawing data={data} className="w-40" compact />;
}

/** The three sides as a radar chart (shadcn/ui's chart on Recharts): each
 * axis reaches as far as its share of the weighted risk, so the shape
 * leans to the side that carries most. The axis says the side, the stance
 * on it and its weight; the most constrained side is in the warning
 * colour, and said in words in the list beneath. A hold is the side kept, so it is drawn as the solid point. */
function TriangleDrawing({ data, className = "w-full max-w-[22rem]", compact = false }: { data: TripleConstraint; className?: string; compact?: boolean }) {
  const order: Constraint[] = ["scope", "schedule", "cost"];
  const bySide = new Map(data.sides.map((s) => [s.constraint as Constraint, s] as const));
  const points = order.map((c) => {
    const s = bySide.get(c);
    return { side: c, share: Math.round((s?.share ?? 0) * 100), stance: s?.stance, exposure: s?.exposure ?? 0 };
  });
  const config = { share: { label: tc.shareLabel, color: "var(--primary)" } } satisfies ChartConfig;
  return (
    <figure className="m-0" aria-label={tc.overviewLabel} role="img">
      <ChartContainer config={config} className={`aspect-[5/4] ${className}`}>
        <RadarChart data={points} cy="58%" outerRadius={compact ? "66%" : "72%"} margin={{ top: 4, right: 32, bottom: 4, left: 32 }}>
          <PolarGrid />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <PolarAngleAxis dataKey="side" tick={(props: AxisTick) => <SideTick {...props} compact={compact} points={points} most={data.mostConstrained} />} />
          {compact ? null : <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />}
          <Radar dataKey="share" fill="var(--color-share)" fillOpacity={0.25} stroke="var(--color-share)" dot={{ r: 3, fillOpacity: 1 }} isAnimationActive={false} />
        </RadarChart>
      </ChartContainer>
    </figure>
  );
}

type AxisTick = { x?: number | string; y?: number | string; textAnchor?: "start" | "middle" | "end" | "inherit"; payload?: { value: string } };

/** An axis label: the side, then its stance and weight; the most
 * constrained side in the warning colour. */
function SideTick({ x, y, textAnchor, payload, compact, points, most }: AxisTick & { compact: boolean; points: { side: Constraint; stance?: string; exposure: number }[]; most?: string }) {
  const side = payload?.value as Constraint;
  const p = points.find((q) => q.side === side);
  const isMost = most === side;
  const stance = p?.stance ? tc.stanceWord[p.stance] : tc.stanceUnsaid;
  const ny = Number(y);
  // Scope sits at the top: its words go above the point, the others' below.
  const dy = side === "scope" ? -(compact ? 4 : 18) : compact ? 12 : 14;
  return (
    <g data-cartograph-side={side}>
      <text x={x} y={ny + dy} textAnchor={textAnchor} className={`text-[12px] font-semibold ${isMost ? "fill-warning" : "fill-foreground"}`}>
        {tc.sides[side]}
      </text>
      {compact ? null : (
        <text x={x} y={ny + dy + 14} textAnchor={textAnchor} className="fill-muted-foreground text-[11px]">
          {`${stance} · ${p?.exposure ?? 0}`}
        </text>
      )}
    </g>
  );
}

function SideList({
  side,
  most,
  byId,
  names,
  deliverables,
  id,
}: {
  side: ConstraintSide;
  most: boolean;
  byId: ReadonlyMap<string, Risk>;
  names: ReadonlyMap<string, string>;
  deliverables: ReadonlySet<string>;
  id: string;
}) {
  const s = side.constraint as Constraint;
  return (
    <div className="flex flex-col gap-1" data-cartograph-region={`triangle-side-${s}`}>
      <h4 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
        {tc.sideOf(tc.sides[s])}
        <span className="text-xs font-normal text-muted-foreground">
          {side.stance ? tc.stanceWord[side.stance] : tc.stanceUnsaid}
          {" · "}
          {side.exposure > 0 ? tc.weighted(side.exposure, side.share) : tc.noWeight}
        </span>
        {most ? <span className="text-xs font-medium text-warning">{tc.mostConstrained}</span> : null}
      </h4>
      {most && side.stance === "hold" ? <p className="text-xs text-warning">{tc.heldAndMost}</p> : null}
      {side.risks.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-sm">
          {side.risks.map((r) => {
            const step = stepFor(s, r.on, deliverables);
            return (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-pretty">{byId.get(r.id)?.description || rc.unnamed}</span>
                {r.impact ? <span className="text-xs text-muted-foreground">{rc.levels[r.impact]}</span> : null}
                {r.on && names.get(r.on) ? <span className="text-xs text-muted-foreground">{tc.on(names.get(r.on)!)}</span> : null}
                <Link to={`/projects/$id/initiation/${step}`} params={{ id }} className="text-xs underline">
                  {tc.goTo(pc.sections[step])}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {side.unweighed > 0 || side.unanswered > 0 ? (
        <p className="text-xs text-muted-foreground">
          {[side.unweighed > 0 ? tc.unweighed(side.unweighed) : "", side.unanswered > 0 ? tc.unanswered(side.unanswered) : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
