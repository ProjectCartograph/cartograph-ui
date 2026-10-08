import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Circle, CircleDot, Lock, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useClient } from "@/client/context";
import type { OrderStage } from "@/client/port";
import { copy } from "@/copy";
import { entryFor, useGlossary } from "@/components/glossary";
import { Term } from "@/components/Term";
import { WhichKindChoice } from "@/components/WhichKind";
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
      {/* What the work is, by Cartograph's questions rather than by what a
          document calls it (engine TAXONOMY.md D56). */}
      <section className="flex flex-col gap-3" aria-label={nc.work} data-cartograph-region="new-work">
        <h2 className="text-base font-medium">{nc.work}</h2>
        <p className="text-sm text-muted-foreground">{copy.whichKind.hint}</p>
        <WhichKindChoice />
      </section>
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
