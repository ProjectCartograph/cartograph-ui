import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Briefcase, Compass, CornerDownRight, Eye, Gauge, Pencil, TriangleAlert } from "lucide-react";

import { mayWrite, useSession } from "@/access/access";
import { useClient } from "@/client/context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

/** Wide enough for the tree and a preview beside it; narrower screens
 * open the preview as a slide-over, as on a phone. */
const WIDE = "(min-width: 1280px)";

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(WIDE).matches);
  useEffect(() => {
    const mql = window.matchMedia?.(WIDE);
    if (!mql) return;
    const on = () => setWide(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return wide;
}

/**
 * The strategy at a glance (TAXONOMY.md D24, engine docs/adr/0020): the
 * purpose, then one column per goal with its objectives and their
 * outcomes. The tree carries names only, and a quiet dot on whatever is
 * not finished; what is missing, the SMART marks and the counts are in
 * the preview, which sits beside the tree on a wide screen, so choosing
 * one item after another is one click each (people found the marks on
 * every line loud, and the slide-over slow to walk through).
 */
export function StrategyView() {
  const tree = useGoalTree();
  const wide = useWide();
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
  const choose = (n: GoalNode) => setOpen((o) => (wide && o?.id === n.id ? null : n));

  return (
    <div className="flex flex-col gap-6" data-cartograph-region="strategy">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{sc.title}</h1>
          <Help label={sc.title} hint={sc.hint} />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/goals">{sc.edit}</Link>
        </Button>
      </div>

      <Purpose />

      <div className={wide ? "grid grid-cols-[minmax(0,1fr)_24rem] items-start gap-6" : ""}>
        {pillars.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-muted-foreground">{sc.empty}</p>
            <Button asChild size="sm">
              <Link to="/goals">{sc.edit}</Link>
            </Button>
          </Card>
        ) : (
          <div className={`grid items-start gap-4 ${wide ? "2xl:grid-cols-3 xl:grid-cols-2" : "lg:grid-cols-3"}`}>
            {pillars.map((p) => (
              <Column key={p.id} node={p} levels={levels} chosen={open?.id} onOpen={choose} />
            ))}
          </div>
        )}

        {wide ? (
          <aside
            aria-label={sc.preview}
            className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-y-auto rounded-xl bg-card shadow-sm ring-1 ring-foreground/5"
            data-cartograph-region="goal-detail"
          >
            {open ? (
              <div key={open.id} className="animate-in fade-in duration-200">
                <NodeDetail node={open} levels={levels} names={names} Title={PaneTitle} />
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">{sc.previewEmpty}</p>
            )}
          </aside>
        ) : (
          <Sheet open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null); }}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-cartograph-region="goal-detail">
              {open ? <NodeDetail node={open} levels={levels} names={names} Title={SheetHeading} /> : null}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}

/** The vision and mission at the top of the strategy, edited where they
 * are read by whoever may change a goal. */
function Purpose() {
  const client = useClient();
  const settings = useSettings();
  const { data: session } = useSession();
  // The Purpose manifest, its draft where there is one; settings carry
  // the same, or what a workspace from before 2.7.0 kept there.
  const stated = useQuery({
    queryKey: ["purpose"],
    queryFn: async () => {
      try {
        const v = await client.get("Purpose", "default");
        return (v.manifest.spec ?? {}) as { vision?: string; mission?: string; source?: string };
      } catch {
        return null;
      }
    },
    retry: false,
  });
  const purpose = stated.data ?? settings.data?.purpose;
  const [editing, setEditing] = useState(false);
  const may = mayWrite(session, "Purpose");
  const hasPurpose = !!(purpose?.vision || purpose?.mission);
  return (
    <section aria-label={sc.purpose} className="flex flex-col gap-1.5" data-cartograph-region="purpose">
      {hasPurpose ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Statement icon={Eye} label={sc.vision} text={purpose?.vision} />
          <Statement icon={Compass} label={sc.mission} text={purpose?.mission} />
        </div>
      ) : (
        <Card className="flex flex-row flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">{sc.purposeNotStated}</p>
          {may ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              {sc.statePurpose}
            </Button>
          ) : null}
        </Card>
      )}
      {hasPurpose ? (
        <div className="flex items-center justify-between gap-2">
          {purpose?.source ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="size-3.5" aria-hidden="true" />
              {purpose.source}
            </p>
          ) : (
            <span />
          )}
          {may ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              {sc.editPurpose}
            </Button>
          ) : null}
        </div>
      ) : null}
      {editing ? <PurposeDialog initial={purpose ?? {}} onClose={() => setEditing(false)} /> : null}
    </section>
  );
}

function PurposeDialog({ initial, onClose }: { initial: { vision?: string; mission?: string; source?: string }; onClose: () => void }) {
  const client = useClient();
  const queries = useQueryClient();
  const d = sc.purposeDialog;
  const [vision, setVision] = useState(initial.vision ?? "");
  const [mission, setMission] = useState(initial.mission ?? "");
  const [source, setSource] = useState(initial.source ?? "");
  const save = useMutation({
    mutationFn: () =>
      client.saveVersion(
        "Purpose",
        "default",
        {
          apiVersion: "cartograph/v1",
          kind: "Purpose",
          metadata: { id: "default", name: d.title },
          spec: {
            ...(vision.trim() ? { vision: vision.trim() } : {}),
            ...(mission.trim() ? { mission: mission.trim() } : {}),
            ...(source.trim() ? { source: source.trim() } : {}),
          },
        },
        d.reason,
      ),
    onSuccess: async () => {
      await Promise.all([queries.invalidateQueries({ queryKey: ["purpose"] }), queries.invalidateQueries({ queryKey: ["settings"] })]);
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d.title}</DialogTitle>
          <DialogDescription>{d.hint}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purpose-vision">{d.vision}</Label>
            <p className="text-xs text-muted-foreground">{d.visionHint}</p>
            <Textarea id="purpose-vision" data-cartograph-field="/spec/vision" value={vision} maxLength={600} onChange={(e) => setVision(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purpose-mission">{d.mission}</Label>
            <p className="text-xs text-muted-foreground">{d.missionHint}</p>
            <Textarea id="purpose-mission" data-cartograph-field="/spec/mission" value={mission} maxLength={600} onChange={(e) => setMission(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purpose-source">{d.source}</Label>
            <p className="text-xs text-muted-foreground">{d.sourceHint}</p>
            <Input id="purpose-source" data-cartograph-field="/spec/source" value={source} maxLength={160} onChange={(e) => setSource(e.target.value)} />
          </div>
          {save.error ? <p className="text-sm text-destructive">{save.error.message}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {d.cancel}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || (!vision.trim() && !mission.trim())}>
            {d.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Vision or mission as a card of its own, in full, at a readable
 * width (Programme Lead, 2026-09-30: side by side, as in the guide). */
function Statement({ icon: Icon, label, text }: { icon: typeof Eye; label: string; text?: string }) {
  return (
    <Card className="gap-2 bg-transparent p-4 shadow-none ring-1 ring-inset ring-border">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      {text ? (
        <p className="max-w-[60ch] text-base font-medium leading-relaxed text-pretty">{text}</p>
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

/** What an item still lacks, in words: the SMART criteria it does not yet
 * meet, and for an outcome a gap, work and an indicator. */
export function unfinished(n: GoalNode): string[] {
  const out: string[] = [];
  if (n.smart) {
    const missing = (Object.keys(copy.smart.names) as (keyof typeof copy.smart.names)[])
      .filter((k) => !n.smart?.[k])
      .map((k) => copy.smart.names[k]);
    if (missing.length > 0) out.push(sc.smartMissing(missing));
  }
  if (n.level === "outcome") {
    if ((n.gaps?.length ?? 0) === 0) out.push(sc.noGap);
    if (workCount(n) === 0) out.push(sc.noWork);
    if (n.aligned.kpis === 0) out.push(sc.noKpi);
  }
  return out;
}

/** One quiet dot where something is unfinished, saying what on hover and
 * to a screen reader; nothing where all is well. */
function Attention({ node }: { node: GoalNode }) {
  const what = unfinished(node);
  if (what.length === 0) return null;
  const label = sc.attention(what);
  return (
    <span className="mt-1.5 flex size-2 shrink-0 rounded-full bg-warning/60" role="img" aria-label={label} title={label} data-slot="attention" />
  );
}

function Column({ node, levels, chosen, onOpen }: { node: GoalNode; levels: string[]; chosen?: string; onOpen: (n: GoalNode) => void }) {
  const objectives = node.children ?? [];
  const row = (n: GoalNode, cls: string) =>
    `flex w-full items-start gap-2 rounded-md text-left transition-colors ${cls} ${chosen === n.id ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`;
  return (
    <section aria-label={node.name} className="flex flex-col gap-2" data-cartograph-region={`goal-${node.id}`}>
      <button type="button" onClick={() => onOpen(node)} aria-current={chosen === node.id || undefined} className={row(node, "px-1 py-1 font-semibold")}>
        <LevelIcon node={node} levels={levels} />
        <span className="flex flex-1 flex-col">
          {node.name}
          {node.horizon ? <span className="text-xs font-normal text-muted-foreground">{span(node.horizon)}</span> : null}
        </span>
        <Attention node={node} />
      </button>
      {objectives.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{sc.noObjectives}</p>
      ) : (
        objectives.map((o) => (
          <Card key={o.id} className="gap-1 bg-transparent p-2 shadow-none ring-1 ring-inset ring-border">
            <button type="button" onClick={() => onOpen(o)} aria-current={chosen === o.id || undefined} className={row(o, "px-1 py-1 text-sm font-medium")}>
              <LevelIcon node={o} levels={levels} />
              <span className="flex-1">{o.name}</span>
              <Attention node={o} />
            </button>
            <ul className="flex flex-col">
              {(o.children ?? []).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onOpen(c)} aria-current={chosen === c.id || undefined} className={row(c, "py-1 pr-1 pl-6 text-sm")}>
                    <LevelIcon node={c} levels={levels} />
                    <span className="min-w-0 flex-1">{c.name}</span>
                    <Attention node={c} />
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

type TitleProps = { level: React.ReactNode; title: string; context: React.ReactNode; description: React.ReactNode };

function PaneTitle({ level, title, context, description }: TitleProps) {
  return (
    <div className="flex flex-col gap-1.5 p-4 pb-0">
      {level}
      <h2 className="font-semibold leading-snug">{title}</h2>
      {context}
      {description ? <p className="text-sm">{description}</p> : null}
    </div>
  );
}

function SheetHeading({ level, title, context, description }: TitleProps) {
  return (
    <SheetHeader>
      {level}
      <SheetTitle>{title}</SheetTitle>
      {context}
      <SheetDescription className="text-foreground">{description}</SheetDescription>
    </SheetHeader>
  );
}

/** Everything the tree leaves out, for one item: in the preview pane, or
 * in the slide-over on a narrow screen. */
function NodeDetail({ node, levels, names, Title }: {
  node: GoalNode;
  levels: string[];
  names: Map<string, string>;
  Title: (p: TitleProps) => React.ReactNode;
}) {
  const what = unfinished(node);
  return (
    <>
      <Title
        level={<div className="flex items-center gap-2"><LevelBadge level={node.level} levels={levels} /><SmartMarks smart={node.smart} /></div>}
        title={node.name}
        context={<AimContext horizon={node.horizon} owner={node.owner} />}
        description={node.objective && node.objective !== node.name ? node.objective : null}
      />
      <div className="flex flex-col gap-5 p-4 text-sm">
        {what.length > 0 ? (
          <p className="flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-2 text-xs text-warning-foreground" data-slot="unfinished">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            {sc.attention(what)}
          </p>
        ) : null}

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
          <span className="flex items-center gap-1" aria-label={`${sc.gaps}: ${node.gaps?.length ?? 0}`}>
            <TriangleAlert className="size-3.5" aria-hidden="true" />{node.gaps?.length ?? 0}
          </span>
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
