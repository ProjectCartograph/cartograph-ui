import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useClient } from "@/client/context";
import type { ConstraintSide, TripleConstraint } from "@/client/port";
import { copy } from "@/copy";
import { useProjectStore } from "../store";
import type { Constraint, InitiationSection, Risk } from "../types";
import { bearsOnOf } from "./triangle";

const tc = copy.projects.triangle;
const rc = copy.projects.risks;
const pc = copy.projects;

/** Where each corner sits in the drawing: scope at the top. */
const AT: Record<Constraint, [number, number]> = { scope: [200, 70], schedule: [90, 240], cost: [310, 240] };

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
      <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_1fr] md:items-start">
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

function TriangleDrawing({ data }: { data: TripleConstraint }) {
  const at = (s: ConstraintSide) => AT[s.constraint as Constraint];
  const [a, b, c] = [AT.scope, AT.schedule, AT.cost];
  return (
    <figure className="m-0">
      <svg viewBox="0 0 400 320" className="w-full max-w-[22rem]" role="img" aria-label={tc.overviewLabel}>
        <path d={`M${a[0]},${a[1]} L${b[0]},${b[1]} L${c[0]},${c[1]} Z`} className="fill-none stroke-border" strokeWidth={1.5} />
        {data.sides.map((s) => {
          const [x, y] = at(s);
          const r = 12 + 30 * Math.sqrt(s.share);
          const most = data.mostConstrained === s.constraint;
          const fill =
            s.stance === "hold" ? "fill-foreground/80" : s.stance === "adjust" ? "fill-muted-foreground/35" : "fill-background";
          const stroke = most ? "stroke-warning" : s.stance === "concede" ? "stroke-muted-foreground" : "stroke-foreground/70";
          const label = s.constraint === "scope" ? y - r - 22 : y + r + 18;
          const stance = s.stance ? tc.stanceWord[s.stance] : tc.stanceUnsaid;
          return (
            <g key={s.constraint} data-cartograph-side={s.constraint}>
              <circle
                cx={x}
                cy={y}
                r={r}
                className={`${fill} ${stroke}`}
                strokeWidth={most ? 4 : 1.5}
                strokeDasharray={s.stance === "concede" ? "4 3" : undefined}
              />
              <text x={x} y={label} textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
                {tc.sides[s.constraint]}
              </text>
              <text x={x} y={label + 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                {`${stance} · ${s.exposure}${most ? ` · ${tc.mostConstrained.toLowerCase()}` : ""}`}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
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
