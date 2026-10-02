import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Boxes, Check, Circle, CircleDot, Flag, FolderKanban, Layers, Lock, Plus, Repeat, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useClient } from "@/client/context";
import type { OrderStage } from "@/client/port";
import { copy } from "@/copy";
import { kindOf, type Ends, type NewKind as Kind, type Size } from "@/definition/kindOf";
import { KPIAddDialog } from "@/kpis/KPIAddDialog";

const nc = copy.newWork;

/** The strategy's stages this page lists; the work's are asked for below. */
const STRATEGY = ["purpose", "goal", "objective", "outcome", "kpi", "gap", "assumption"];

/** Where each strategy stage is written. A KPI is added in a dialog here. */
const WHERE: Record<string, string> = {
  purpose: "/",
  goal: "/goals",
  objective: "/goals",
  outcome: "/goals",
  gap: "/gaps/new",
  assumption: "/sheets/Assumption",
};

/** The work stage each answer makes. */
const STAGE_OF: Record<Kind, string> = { project: "project", component: "project", programme: "programme", operation: "operation" };

/**
 * New, in the order of work (TAXONOMY.md D28). The record is written from
 * the top down: a purpose, the goals, objectives and outcomes under it,
 * the indicators that measure them and the gaps they close, then the work
 * that delivers them. Each names only what comes before it, so a new
 * workspace starts at its purpose and nothing written is opened again to
 * be linked. The engine says how far the workspace has got and which stage
 * comes next (GET /order); this page shows it and leads there.
 *
 * Work is last, and asks what it is by picking. Every standard separates
 * work that finishes from work that keeps running (PMI, GovS 002, PRINCE2,
 * ITIL), and then asks whether one project can deliver the change (MSP)
 * under one sponsor and one budget (D14). It opens once the strategy has an
 * outcome for the work to serve.
 */
export function NewWork() {
  const client = useClient();
  const order = useQuery({ queryKey: ["order"], queryFn: () => client.order() });
  const stages = new Map((order.data?.stages ?? []).map((s) => [s.key, s]));
  const strategy = STRATEGY.map((k) => stages.get(k)).filter((s): s is OrderStage => !!s);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{nc.title}</h1>
        {nc.subtitle ? <p className="text-muted-foreground">{nc.subtitle}</p> : null}
      </div>
      <section className="flex flex-col gap-3" aria-label={nc.strategy} data-cartograph-region="new-strategy">
        <h2 className="text-base font-medium">{nc.strategy}</h2>
        <ol className="flex flex-col gap-2">
          {strategy.map((s) => (
            <StageRow key={s.key} stage={s} next={order.data?.next === s.key} />
          ))}
        </ol>
      </section>
      <WorkQuestions stages={stages} next={order.data?.next} loaded={!!order.data} />
    </div>
  );
}

function StageRow({ stage, next }: { stage: OrderStage; next: boolean }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const waiting = stage.state === "waiting";
  const Icon = stage.state === "done" ? Check : waiting ? Lock : next ? CircleDot : Circle;
  const label = nc.stage[stage.key] ?? stage.key;
  const status =
    stage.state === "done"
      ? nc.count(stage.count)
      : waiting
        ? nc.after((stage.waiting ?? []).map((k) => nc.stage[k] ?? k).join(", "))
        : next
          ? nc.startHere
          : stage.optional
            ? nc.optional
            : "";
  const action = (
    <>
      <Plus />
      {nc.add}
    </>
  );
  return (
    <li
      className={`flex items-center gap-3 rounded-xl p-3 ring-1 transition-colors motion-reduce:transition-none ${
        next ? "bg-primary/5 ring-2 ring-primary" : "ring-foreground/10"
      } ${waiting ? "opacity-60" : ""}`}
      data-cartograph-stage={stage.key}
      data-state={next ? "next" : stage.state}
      aria-current={next ? "step" : undefined}
    >
      <Icon className={`size-5 shrink-0 ${next || stage.state === "done" ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{nc.stageDetail[stage.key]}</span>
      </span>
      {status ? <span className={`shrink-0 text-xs ${next ? "font-medium text-primary" : "text-muted-foreground"}`}>{status}</span> : null}
      {waiting ? null : stage.key === "kpi" ? (
        <>
          <Button type="button" size="sm" variant={next ? "default" : "outline"} onClick={() => setAdding(true)}>
            {action}
          </Button>
          <KPIAddDialog
            open={adding}
            onOpenChange={setAdding}
            onAdded={(id) => void navigate({ to: "/kpis/$id", params: { id } })}
          />
        </>
      ) : WHERE[stage.key] ? (
        <Button asChild size="sm" variant={next ? "default" : "outline"}>
          <Link to={WHERE[stage.key]}>{action}</Link>
        </Button>
      ) : null}
    </li>
  );
}

function WorkQuestions({ stages, next, loaded }: { stages: Map<string, OrderStage>; next?: string; loaded: boolean }) {
  const navigate = useNavigate();
  const [ends, setEnds] = useState<Ends | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  // Work serves an outcome: until the strategy has one, it waits.
  const waits = !loaded || stages.get("project")?.state === "waiting";
  const kind = waits ? null : kindOf(ends, size);
  const stage = kind ? stages.get(STAGE_OF[kind]) : undefined;
  const kindWaits = stage?.state === "waiting";
  const nextName = next ? (nc.stage[next] ?? next) : "";

  function go() {
    if (kind === "operation") void navigate({ to: "/operations/new" });
    else if (kind === "programme") void navigate({ to: "/programmes/new" });
    else if (kind === "component") void navigate({ to: "/projects/new", search: { partOf: true } });
    else if (kind === "project") void navigate({ to: "/projects/new", search: {} });
  }

  return (
    <section className="flex flex-col gap-6" aria-label={nc.work} data-cartograph-region="new-work">
      <h2 className="text-base font-medium">{nc.work}</h2>
      {waits && loaded ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {nc.workWaits(nextName)}
        </p>
      ) : null}
      <div className={`flex flex-col gap-8 ${waits ? "opacity-60" : ""}`}>
        <Question label={nc.endsQuestion} region="new-ends">
          <Choice icon={Flag} title={nc.finishes} detail={nc.finishesDetail} picked={ends === "finishes"} disabled={waits} onPick={() => setEnds("finishes")} />
          <Choice
            icon={Repeat}
            title={nc.runs}
            detail={nc.runsDetail}
            picked={ends === "runs"}
            disabled={waits}
            onPick={() => {
              setEnds("runs");
              setSize(null);
            }}
          />
        </Question>

        {ends === "finishes" ? (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none">
            <Question label={nc.sizeQuestion} region="new-size">
              <Choice icon={FolderKanban} title={nc.one} detail={nc.oneDetail} picked={size === "one"} disabled={waits} onPick={() => setSize("one")} />
              <Choice icon={Boxes} title={nc.part} detail={nc.partDetail} picked={size === "part"} disabled={waits} onPick={() => setSize("part")} />
              <Choice icon={Layers} title={nc.many} detail={nc.manyDetail} picked={size === "many"} disabled={waits} onPick={() => setSize("many")} />
            </Question>
          </div>
        ) : null}
      </div>

      {kind ? (
        <div
          className="flex flex-col gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20 animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none"
          data-slot="new-verdict"
          data-cartograph-region="new-verdict"
          role="status"
        >
          <p className="flex items-center gap-2 font-medium">
            <KindMark kind={kind} />
            {nc.verdict[kind]}
          </p>
          <p className="text-sm text-muted-foreground">{nc.because[kind]}</p>
          {kindWaits && stage ? (
            <p className="text-sm text-muted-foreground">
              {nc.after((stage.waiting ?? []).map((k) => nc.stage[k] ?? k).join(", "))}
            </p>
          ) : null}
          <div>
            {kindWaits && stage?.waiting?.[0] && WHERE[stage.waiting[0]] ? (
              <Button asChild>
                <Link to={WHERE[stage.waiting[0]]}>
                  {nc.goTo(nc.stage[stage.waiting[0]] ?? stage.waiting[0])}
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button type="button" onClick={go} disabled={kindWaits}>
                {nc.start[kind]}
                <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function KindMark({ kind }: { kind: Kind }) {
  const Icon = { project: FolderKanban, component: Boxes, programme: Layers, operation: Settings2 }[kind];
  return <Icon className="size-5 text-primary" aria-hidden="true" />;
}

function Question({ label, region, children }: { label: string; region: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3" data-cartograph-region={region}>
      <legend className="mb-3 text-base font-medium">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Choice({
  icon: Icon,
  title,
  detail,
  picked,
  disabled,
  onPick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  picked: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={picked}
      disabled={disabled}
      onClick={onPick}
      className={`flex items-start gap-3 rounded-xl p-4 text-left ring-1 transition-all duration-200 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:pointer-events-none motion-reduce:transition-none ${
        picked ? "bg-primary/5 ring-2 ring-primary" : "ring-foreground/10"
      }`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${picked ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
      <span className="flex flex-col gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}
