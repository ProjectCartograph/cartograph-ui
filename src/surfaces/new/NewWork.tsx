import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Boxes, Check, Circle, CircleDot, Flag, FolderKanban, Hourglass, Layers, Lock, Plus, Repeat, Settings2, BriefcaseBusiness, Folders } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useClient } from "@/client/context";
import type { OrderStage } from "@/client/port";
import { copy } from "@/copy";
import { entryFor, useGlossary } from "@/components/glossary";
import { Term } from "@/components/Term";
import { kindOf, type Ends, type InCharge, type NewKind as Kind, type PartOf, type Today, type YesNo } from "@/definition/kindOf";
import { ChoiceCard } from "@/components/ChoiceCard";
import { KPIAddDialog } from "@/kpis/KPIAddDialog";

const nc = copy.newWork;

/** The strategy's stages this page lists; the work's are asked for below. */
const STRATEGY = ["purpose", "goal", "objective", "outcome", "kpi", "gap", "assumption"];

/** Where each strategy stage is written. A KPI is added in a dialog here. */
const WHERE: Record<string, string> = {
  purpose: "/strategy",
  goal: "/goals",
  objective: "/goals",
  outcome: "/goals",
  gap: "/gaps/new",
  assumption: "/sheets/Assumption",
};

/** The work stage each answer makes, and the word the glossary defines
 * it by. */
const STAGE_OF: Record<Kind, string> = {
  project: "project",
  component: "project",
  programme: "programme",
  portfolio: "portfolio",
  collection: "project",
  operation: "operation",
  service: "operation",
};
const TERM_OF: Record<Kind, string> = {
  project: "project",
  component: "component",
  programme: "programme",
  portfolio: "portfolio",
  collection: "project",
  operation: "operation",
  service: "operation",
};

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
            <StageRow key={s.key} stage={s} n={strategy.indexOf(s) + 1} next={order.data?.next === s.key} />
          ))}
        </ol>
      </section>
      <WorkQuestions stages={stages} next={order.data?.next} loaded={!!order.data} />
    </div>
  );
}

/**
 * One stage of the strategy. The stage to write now is the page's focal
 * point (engine DESIGN_RULES "Where the eye lands"): a larger raised card
 * with its number, its meaning and the page's one filled action. Done and
 * waiting stages are compact rows, so the eye goes to the one that is not.
 */
function StageRow({ stage, n, next }: { stage: OrderStage; n: number; next: boolean }) {
  const navigate = useNavigate();
  // What the stage is, as the glossary defines it (TAXONOMY.md D29).
  const meaning = entryFor(useGlossary().data, stage.key)?.summary;
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
      className={`flex items-center gap-3 rounded-xl transition-colors motion-reduce:transition-none ${
        next ? "my-1 bg-card p-5 shadow-md ring-2 ring-primary" : "px-3 py-2 bg-card ring-1 ring-foreground/10"
      } ${waiting ? "opacity-55" : ""}`}
      data-cartograph-stage={stage.key}
      data-state={next ? "next" : stage.state}
      aria-current={next ? "step" : undefined}
    >
      {next ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground" aria-hidden="true">
          {n}
        </span>
      ) : (
        <Icon className={`size-4 shrink-0 ${stage.state === "done" ? "text-success" : "text-muted-foreground"}`} aria-hidden="true" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`flex items-center gap-1 font-medium ${next ? "text-lg" : "text-sm"}`}>
          {label}
          <Term word={stage.key} />
        </span>
        {meaning && (next || stage.state !== "done") ? (
          <span className={`text-muted-foreground ${next ? "text-sm" : "text-xs"}`}>{meaning}</span>
        ) : null}
      </span>
      {status ? <span className={`shrink-0 text-xs ${next ? "font-medium text-primary" : "text-muted-foreground"}`}>{status}</span> : null}
      {waiting ? null : stage.key === "kpi" ? (
        <>
          <Button type="button" size={next ? "default" : "sm"} variant={next ? "default" : "ghost"} onClick={() => setAdding(true)}>
            {action}
          </Button>
          <KPIAddDialog
            open={adding}
            onOpenChange={setAdding}
            onAdded={(id) => void navigate({ to: "/kpis/$id", params: { id } })}
          />
        </>
      ) : WHERE[stage.key] ? (
        <Button asChild size={next ? "default" : "sm"} variant={next ? "default" : "ghost"}>
          <Link to={WHERE[stage.key]}>{action}</Link>
        </Button>
      ) : null}
    </li>
  );
}

function WorkQuestions({ stages, next, loaded }: { stages: Map<string, OrderStage>; next?: string; loaded: boolean }) {
  const navigate = useNavigate();
  const [ends, setEnds] = useState<Ends | null>(null);
  const [answer, setAnswer] = useState<InCharge | Today | null>(null);
  const [partOf, setPartOf] = useState<PartOf | null>(null);
  const [together, setTogether] = useState<YesNo | null>(null);
  const [funds, setFunds] = useState<YesNo | null>(null);
  // Work that finishes serves an outcome, so it waits until the strategy
  // has one. A service waits on nothing: one that runs today is recorded
  // as it is (TAXONOMY.md D30).
  const finishWaits = !loaded || stages.get("project")?.state === "waiting";
  const kind =
    ends === "finishes" && finishWaits
      ? null
      : ends === "runs"
        ? kindOf({ ends, today: answer as Today | null })
        : kindOf({ ends, inCharge: answer as InCharge | null, partOf, together, funds });
  const stage = kind ? stages.get(STAGE_OF[kind]) : undefined;
  const kindWaits = stage?.state === "waiting";
  const nextName = next ? (nc.stage[next] ?? next) : "";

  function go() {
    if (kind === "operation") void navigate({ to: "/operations/new", search: {} });
    else if (kind === "service") void navigate({ to: "/operations/new", search: { status: "planned" } });
    else if (kind === "programme") void navigate({ to: "/programmes/new" });
    else if (kind === "portfolio") void navigate({ to: "/portfolios/new" });
    else if (kind === "collection") void navigate({ to: "/projects" });
    // A project starts by preparing what its walk picks from
    // (TAXONOMY.md D34); it can be started from there at any point.
    else if (kind === "component") void navigate({ to: "/projects/prepare", search: { partOf: true } });
    else if (kind === "project") void navigate({ to: "/projects/prepare", search: {} });
  }
  function pickEnds(next: Ends) {
    setEnds(next);
    setAnswer(null);
    setPartOf(null);
    setTogether(null);
    setFunds(null);
  }
  function pickInCharge(next: InCharge) {
    setAnswer(next);
    setPartOf(null);
    setTogether(null);
    setFunds(null);
  }

  return (
    <section className="flex flex-col gap-6" aria-label={nc.work} data-cartograph-region="new-work">
      <h2 className="text-base font-medium">{nc.work}</h2>
      <Question label={nc.endsQuestion} region="new-ends">
        <ChoiceCard icon={Flag} title={nc.finishes} detail={nc.finishesDetail} picked={ends === "finishes"} onPick={() => pickEnds("finishes")} />
        <ChoiceCard icon={Repeat} title={nc.runs} detail={nc.runsDetail} picked={ends === "runs"} onPick={() => pickEnds("runs")} />
      </Question>

      {ends === "runs" ? (
        <div className="animate-in fade-in slide-in-from-top-2 duration-250 ease-enter">
          <Question label={nc.todayQuestion} region="new-today">
            <ChoiceCard icon={Settings2} title={nc.today} detail={nc.todayDetail} picked={answer === "today"} onPick={() => setAnswer("today")} />
            <ChoiceCard icon={Hourglass} title={nc.isNew} detail={nc.isNewDetail} picked={answer === "new"} onPick={() => setAnswer("new")} />
          </Question>
        </div>
      ) : null}

      {ends === "finishes" && finishWaits && loaded ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {nc.workWaits(nextName)}
        </p>
      ) : null}

      {ends === "finishes" ? (
        <div className={`animate-in fade-in slide-in-from-top-2 duration-250 ease-enter ${finishWaits ? "opacity-60" : ""}`}>
          <Question label={nc.inChargeQuestion} region="new-in-charge">
            <ChoiceCard icon={FolderKanban} title={nc.one} detail={nc.oneDetail} picked={answer === "one"} disabled={finishWaits} onPick={() => pickInCharge("one")} />
            <ChoiceCard icon={Layers} title={nc.many} detail={nc.manyDetail} picked={answer === "many"} disabled={finishWaits} onPick={() => pickInCharge("many")} />
          </Question>
        </div>
      ) : null}

      {ends === "finishes" && answer === "one" && !finishWaits ? (
        <div className="animate-in fade-in slide-in-from-top-2 duration-250 ease-enter">
          <Question label={nc.partOfQuestion} region="new-part-of">
            <ChoiceCard icon={FolderKanban} title={nc.own} detail={nc.ownDetail} picked={partOf === "own"} onPick={() => setPartOf("own")} />
            <ChoiceCard icon={Boxes} title={nc.part} detail={nc.partDetail} picked={partOf === "part"} onPick={() => setPartOf("part")} />
          </Question>
        </div>
      ) : null}

      {ends === "finishes" && answer === "many" && !finishWaits ? (
        <div className="animate-in fade-in slide-in-from-top-2 duration-250 ease-enter">
          <Question label={nc.togetherQuestion} region="new-together">
            <ChoiceCard icon={Layers} title={nc.together} detail={nc.togetherDetail} picked={together === "yes"} onPick={() => (setTogether("yes"), setFunds(null))} />
            <ChoiceCard icon={Folders} title={nc.apart} detail={nc.apartDetail} picked={together === "no"} onPick={() => setTogether("no")} />
          </Question>
        </div>
      ) : null}

      {ends === "finishes" && answer === "many" && together === "no" && !finishWaits ? (
        <div className="animate-in fade-in slide-in-from-top-2 duration-250 ease-enter">
          <Question label={nc.fundsQuestion} region="new-funds">
            <ChoiceCard icon={BriefcaseBusiness} title={nc.funds} detail={nc.fundsDetail} picked={funds === "yes"} onPick={() => setFunds("yes")} />
            <ChoiceCard icon={Folders} title={nc.loose} detail={nc.looseDetail} picked={funds === "no"} onPick={() => setFunds("no")} />
          </Question>
        </div>
      ) : null}

      {kind ? (
        <div
          className="flex flex-col gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/20 animate-in fade-in zoom-in-95 duration-250 ease-enter"
          data-slot="new-verdict"
          data-cartograph-region="new-verdict"
          role="status"
        >
          <p className="flex items-center gap-2 font-medium">
            <KindMark kind={kind} />
            {nc.verdict[kind]}
            <Term word={TERM_OF[kind]} />
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
  const Icon = {
    project: FolderKanban,
    component: Boxes,
    programme: Layers,
    portfolio: BriefcaseBusiness,
    collection: Folders,
    operation: Settings2,
    service: Hourglass,
  }[kind];
  return <Icon className="size-5 text-primary" aria-hidden="true" />;
}

/** A question answered by picking, its choices one per line so each reads
 * in full. */
function Question({ label, region, children }: { label: string; region: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3" data-cartograph-region={region}>
      <legend className="mb-3 text-base font-medium">{label}</legend>
      <div className="flex flex-col gap-2">{children}</div>
    </fieldset>
  );
}
