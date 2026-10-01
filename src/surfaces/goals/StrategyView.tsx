import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Briefcase, Compass, CornerDownRight, Eye, Gauge, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Help } from "@/components/guidance";
import { ErrorAlert } from "@/components/error-alert";
import { vocabIcon } from "@/components/vocab";
import { copy } from "@/copy";
import { useGoalTree, useSettings } from "./api";
import { LevelBadge, levelName } from "./levels";
import { SmartMarks } from "./SmartMarks";
import { AimContext, span } from "./GoalEditor";
import type { GoalNode } from "./tree-types";

const sc = copy.strategy;

/**
 * The strategy at a glance (TAXONOMY.md D24): the purpose, then one column
 * per goal with its objectives and their outcomes. The page carries names
 * and marks only; a goal's aim, reason, gaps and links open in a side
 * panel, so the whole strategy fits on one screen (Programme Lead,
 * 2026-09-30: the first version was far too text-heavy).
 *
 * Each outcome carries three marks, each with its count: the gaps it
 * closes, the work aligned to it, and the KPIs that measure it. A mark that
 * is missing is the finding: an outcome no work serves, or no gap explains.
 */
export function StrategyView() {
  const tree = useGoalTree();
  const settings = useSettings();
  const [open, setOpen] = useState<GoalNode | null>(null);

  if (tree.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (tree.isError || !tree.data) {
    return <ErrorAlert message={sc.error} onRetry={() => tree.refetch()} />;
  }

  const levels = tree.data.levels;
  const pillars = tree.data.nodes.filter((n) => n.level === "goal");
  const names = new Map<string, string>();
  const walk = (ns: GoalNode[]) => ns.forEach((n) => { names.set(n.id, n.name); walk(n.children ?? []); });
  walk(tree.data.nodes);
  const purpose = settings.data?.purpose;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{sc.title}</h1>
          <Help label={sc.title} hint={sc.hint} />
        </div>
        <div className="flex items-center gap-4">
          <Legend />
          <Button asChild variant="outline" size="sm">
            <Link to="/goals">{sc.edit}</Link>
          </Button>
        </div>
      </div>

      <section aria-label={sc.purpose} className="flex flex-col gap-1.5">
        <div className="grid gap-3 md:grid-cols-2">
          <Statement icon={Eye} label={sc.vision} text={purpose?.vision} />
          <Statement icon={Compass} label={sc.mission} text={purpose?.mission} />
        </div>
        {purpose?.source ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" aria-hidden="true" />
            {purpose.source}
          </p>
        ) : null}
      </section>

      {pillars.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm text-muted-foreground">{sc.empty}</p>
          <Button asChild size="sm">
            <Link to="/goals">{sc.edit}</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {pillars.map((p) => (
            <Column key={p.id} node={p} levels={levels} onOpen={setOpen} />
          ))}
        </div>
      )}

      <Detail node={open} levels={levels} names={names} onClose={() => setOpen(null)} />
    </div>
  );
}

/** What the three marks mean, once, beside the title. */
function Legend() {
  return (
    <ul aria-label={sc.legend} className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
      <li className="flex items-center gap-1"><TriangleAlert className="size-3.5" aria-hidden="true" />{sc.gaps}</li>
      <li className="flex items-center gap-1"><Briefcase className="size-3.5" aria-hidden="true" />{sc.work}</li>
      <li className="flex items-center gap-1"><Gauge className="size-3.5" aria-hidden="true" />{copy.rail.kpis}</li>
    </ul>
  );
}

/** Vision or mission as a card of its own, in full, at a readable
 * width (Programme Lead, 2026-09-30: side by side, as in the guide). */
function Statement({ icon: Icon, label, text }: { icon: typeof Eye; label: string; text?: string }) {
  return (
    <Card className="gap-2 p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      {text ? (
        <p className="max-w-[60ch] text-sm leading-relaxed">{text}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{sc.notSet}</p>
      )}
    </Card>
  );
}

function LevelIcon({ node, levels }: { node: GoalNode; levels: string[] }) {
  const Icon = vocabIcon("goalLevel", node.level);
  return Icon ? <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label={levelName(node.level, levels)} /> : null;
}

function Column({ node, levels, onOpen }: { node: GoalNode; levels: string[]; onOpen: (n: GoalNode) => void }) {
  const objectives = node.children ?? [];
  return (
    <section aria-label={node.name} className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onOpen(node)}
        className="flex items-center gap-2 rounded-md px-1 py-1 text-left font-semibold hover:bg-muted/60"
      >
        <LevelIcon node={node} levels={levels} />
        <span className="flex flex-1 flex-col">
          {node.name}
          {node.horizon ? <span className="text-xs font-normal text-muted-foreground">{span(node.horizon)}</span> : null}
        </span>
        <SmartMarks smart={node.smart} className="mt-1" />
      </button>
      {objectives.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{sc.noObjectives}</p>
      ) : (
        objectives.map((o) => (
          <Card key={o.id} className="gap-1 p-2">
            <button
              type="button"
              onClick={() => onOpen(o)}
              className="flex items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-medium hover:bg-muted/60"
            >
              <LevelIcon node={o} levels={levels} />
              <span className="flex-1">{o.name}</span>
              <SmartMarks smart={o.smart} className="mt-0.5" />
            </button>
            <ul className="flex flex-col">
              {(o.children ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(c)}
                    className="flex w-full flex-col gap-1 rounded-md py-1 pr-1 pl-6 text-left text-sm hover:bg-muted/60"
                  >
                    <span className="flex items-start gap-2">
                      <LevelIcon node={c} levels={levels} />
                      <span className="min-w-0 flex-1">{c.name}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2 pl-5">
                      <SmartMarks smart={c.smart} />
                      <Marks node={c} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </section>
  );
}

function workCount(n: GoalNode) {
  return n.aligned.projects + n.aligned.programmes + n.aligned.operations;
}

/** The three marks of an outcome, each shown only when it has a count. */
function Marks({ node }: { node: GoalNode }) {
  const items = [
    { n: node.gaps?.length ?? 0, Icon: TriangleAlert, label: sc.gaps },
    { n: workCount(node), Icon: Briefcase, label: sc.work },
    { n: node.aligned.kpis, Icon: Gauge, label: copy.rail.kpis },
  ];
  return (
    <span className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-muted-foreground">
      {items.map(({ n, Icon, label }) => (
        <span
          key={label}
          className={`flex w-7 items-center gap-0.5 ${n === 0 ? "invisible" : ""}`}
          aria-label={`${label}: ${n}`}
          aria-hidden={n === 0}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {n}
        </span>
      ))}
    </span>
  );
}

/** Everything the column leaves out, for one goal. */
function Detail({ node, levels, names, onClose }: {
  node: GoalNode | null;
  levels: string[];
  names: Map<string, string>;
  onClose: () => void;
}) {
  return (
    <Sheet open={node !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {node ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2"><LevelBadge level={node.level} levels={levels} /><SmartMarks smart={node.smart} /></div>
              <SheetTitle>{node.name}</SheetTitle>
              <AimContext horizon={node.horizon} owner={node.owner} />
              <SheetDescription className="text-foreground">
                {node.objective && node.objective !== node.name ? node.objective : null}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4 pb-4 text-sm">
              {node.why ? (
                <Part label={sc.why}>
                  <p className="text-muted-foreground">{node.why}</p>
                </Part>
              ) : null}

              {node.level === "outcome" ? (
                <Part label={sc.gaps} icon={TriangleAlert}>
                  {(node.gaps ?? []).length === 0 ? (
                    <p className="text-muted-foreground">{sc.noGaps}</p>
                  ) : (
                    <ul aria-label={sc.gaps} className="flex flex-col gap-2">
                      {(node.gaps ?? []).map((g) => (
                        <li key={g.id} className="flex flex-col gap-1">
                          <Link to="/gaps/$id" params={{ id: g.id }} className="font-medium hover:underline">
                            {g.name}
                          </Link>
                          <span className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 text-xs">
                            <span className="text-muted-foreground">{g.current ?? sc.notSet}</span>
                            <ArrowRight className="mt-0.5 size-3 text-muted-foreground" aria-label={sc.to} />
                            {g.desired ? (
                              <span>{g.desired}</span>
                            ) : (
                              <Badge variant="outline" className="justify-self-start font-normal">{sc.desiredNotSet}</Badge>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Part>
              ) : null}

              {(node.contributesTo ?? []).length > 0 ? (
                <Part label={sc.leadsTo} icon={CornerDownRight}>
                  <ul className="flex flex-col gap-1">
                    {(node.contributesTo ?? []).map((l) => (
                      <li key={l.goal}>
                        <Link to="/goals/$id" params={{ id: l.goal }} className="font-medium hover:underline">
                          {names.get(l.goal) ?? l.goal}
                        </Link>
                        {l.because ? <span className="text-muted-foreground">: {l.because}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Part>
              ) : null}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1" aria-label={`${sc.work}: ${workCount(node)}`}>
                  <Briefcase className="size-3.5" aria-hidden="true" />{workCount(node)}
                </span>
                <span className="flex items-center gap-1" aria-label={`${copy.rail.kpis}: ${node.aligned.kpis}`}>
                  <Gauge className="size-3.5" aria-hidden="true" />{node.aligned.kpis}
                </span>
              </div>

              <Button asChild size="sm" className="self-start">
                <Link to="/goals/$id" params={{ id: node.id }}>{sc.open}</Link>
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Part({ label, icon: Icon, children }: { label: string; icon?: typeof Eye; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
        {label}
      </h3>
      {children}
    </section>
  );
}
