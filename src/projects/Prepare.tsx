import { useMemo, useState } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronRight, CircleDashed, Plus, SkipForward, Sparkles } from "lucide-react";

import portfolioFlow from "../../contract/flows/portfolio.flow.json";
import programmeFlow from "../../contract/flows/programme.flow.json";
import projectFlow from "../../contract/flows/project.flow.json";
import { termOf } from "@/components/glossary";
import { WorkTextProvider } from "@/components/relevance";
import { FlowBack, FlowNav, FlowNext } from "@/components/walker";
import { useRelevant } from "@/components/useRelevant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { KPIAddDialog } from "@/kpis/KPIAddDialog";
import { useGoalTree } from "@/surfaces/goals/api";
import { PlaceGoalForm } from "@/surfaces/goals/PlaceGoal";
import { SheetAddDialog } from "@/surfaces/sheet/InlineSheetAdd";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

const pc = copy.prepare;
const projectRoute = getRouteApi("/projects/prepare");

/** The kinds whose walks say what to prepare. */
export type PreparedKind = "Project" | "Programme" | "Portfolio";

/** Preparing a project, or a component of one. */
export function PreparePage() {
  return <Prepare kind="Project" partOf={projectRoute.useSearch().partOf} />;
}

/** Preparing a programme. */
export function PrepareProgrammePage() {
  return <Prepare kind="Programme" />;
}

/** Preparing a portfolio. */
export function PreparePortfolioPage() {
  return <Prepare kind="Portfolio" />;
}

interface Item {
  kind: string;
  level?: string;
  needed: boolean;
  guide: string;
}

/** What each walk picks from, in the order to prepare it: the contract's
 * own lists (engine TAXONOMY.md D34). */
const ITEMS: Record<PreparedKind, Item[]> = {
  Project: (projectFlow as { spec: { prepare: Item[] } }).spec.prepare,
  Programme: (programmeFlow as { spec: { prepare: Item[] } }).spec.prepare,
  Portfolio: (portfolioFlow as { spec: { prepare: Item[] } }).spec.prepare,
};

const storeOf = (kind: PreparedKind) => `cartograph.prepare.${kind}`;

function load(kind: PreparedKind): { idea: string; seen: string[] } {
  try {
    const raw = sessionStorage.getItem(storeOf(kind));
    if (raw) return JSON.parse(raw) as { idea: string; seen: string[] };
  } catch {
    // Storage may be unavailable; preparing works without it.
  }
  return { idea: "", seen: [] };
}

function keep(kind: PreparedKind, state: { idea: string; seen: string[] }) {
  try {
    sessionStorage.setItem(storeOf(kind), JSON.stringify(state));
  } catch {
    // As above.
  }
}

const keyOf = (i: Item) => i.kind + (i.level ? `/${i.level}` : "");

/** The word for a prepared kind, as the glossary names it. */
function wordOf(i: Item): string {
  if (pc.names[i.kind]) return pc.names[i.kind];
  const key = i.level ?? (i.kind === "Goal" ? "objective" : undefined) ?? ({ KPI: "kpi", Gap: "gap", Assumption: "assumption", Programme: "programme", Portfolio: "portfolio", Operation: "operation" } as Record<string, string>)[i.kind] ?? i.kind;
  return termOf(key);
}

/**
 * Before a project's walk: the idea in the person's own words, then each
 * thing the walk will pick from, in the order to prepare it, with what
 * already exists (the most relevant to the idea first) and a way to add
 * one with only what the record requires. One is open at a time, the next
 * not yet looked at; any can be opened, skipped or left, and the project
 * can be started at any point. Preparing makes the walk a matter of
 * picking; it is never a gate (engine TAXONOMY.md D34).
 */
export function Prepare({ kind, partOf }: { kind: PreparedKind; partOf?: boolean }) {
  const navigate = useNavigate();
  const items = ITEMS[kind];
  const [state, setState] = useState(() => load(kind));
  const [open, setOpen] = useState<string | null>(null);
  const seen = new Set(state.seen);
  const current = open ?? items.map(keyOf).find((k) => !seen.has(k)) ?? null;

  function update(next: { idea?: string; seen?: string[] }) {
    const merged = { ...state, ...next };
    setState(merged);
    keep(kind, merged);
  }
  function markSeen(i: Item) {
    const k = keyOf(i);
    update({ seen: seen.has(k) ? state.seen : [...state.seen, k] });
    setOpen(null);
  }
  function start() {
    if (kind === "Programme") return void navigate({ to: "/programmes/new", search: {} });
    if (kind === "Portfolio") return void navigate({ to: "/portfolios/new", search: {} });
    const about = state.idea.trim().split(/(?<=[.!?])\s|\n/)[0]?.slice(0, 300) ?? "";
    const idea = state.idea.trim().slice(0, 1000);
    void navigate({ to: "/projects/start", search: { ...(partOf ? { partOf: true } : {}), ...(about ? { about } : {}), ...(idea ? { idea } : {}) } });
  }

  return (
    <WorkTextProvider text={state.idea}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-cartograph-region="prepare">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{pc.title}</h1>
            <p className="text-muted-foreground text-pretty">{pc.subtitle(pc.what[kind])}</p>
          </div>
          <Button type="button" onClick={start}>
            {pc.start(pc.what[kind])}
            <ArrowRight />
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/5">
          <FieldHeading label={pc.ideaLabel} hint={pc.ideaHint} htmlFor="prepare-idea" />
          <Textarea id="prepare-idea" data-cartograph-field="idea" value={state.idea} rows={3} onChange={(e) => update({ idea: e.target.value.slice(0, 1000) })} />
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {pc.progress(items.filter((i) => seen.has(keyOf(i))).length, items.length)}
        </p>
        <ol className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={keyOf(i)}>
              <PrepareRow item={i} isOpen={current === keyOf(i)} seen={seen.has(keyOf(i))} onOpen={() => setOpen(keyOf(i))} onDone={() => markSeen(i)} />
            </li>
          ))}
        </ol>

        <FlowNav>
          <FlowBack label={copy.projects.back} onClick={() => window.history.back()} />
          <FlowNext label={pc.start(pc.what[kind])} onClick={start} />
        </FlowNav>
      </div>
    </WorkTextProvider>
  );
}

/** How many of a kind exist, for a goal at its level. */
function useCount(i: Item): number {
  const refs = useReferenceOptions(i.kind === "Goal" ? "Team" : i.kind);
  const tree = useGoalTree();
  return useMemo(() => {
    if (i.kind !== "Goal") return refs.data?.options.length ?? 0;
    let n = 0;
    const walk = (ns: { level: string; children: unknown[] }[]) => {
      for (const node of ns) {
        if (node.level === i.level) n++;
        walk(node.children as { level: string; children: unknown[] }[]);
      }
    };
    walk((tree.data?.nodes ?? []) as never);
    if (!i.level) {
      // A portfolio's: goals and objectives, never outcomes.
      let all = 0;
      const every = (ns: { level: string; children: unknown[] }[]) => {
        for (const node of ns) {
          if (node.level !== "outcome") all++;
          every(node.children as { level: string; children: unknown[] }[]);
        }
      };
      every((tree.data?.nodes ?? []) as never);
      return all;
    }
    return n;
  }, [i, refs.data, tree.data]);
}

function PrepareRow({ item, isOpen, seen, onOpen, onDone }: { item: Item; isOpen: boolean; seen: boolean; onOpen: () => void; onDone: () => void }) {
  const count = useCount(item);
  const word = wordOf(item);
  const Mark = seen ? Check : isOpen ? ChevronRight : CircleDashed;
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        data-prepare={keyOf(item)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ease-standard hover:bg-muted/60 active:bg-muted"
      >
        <Mark className={`size-4 shrink-0 ${seen ? "text-success" : "text-muted-foreground"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium">{word}</span>
        {item.needed && count === 0 ? <Badge variant="warning">{pc.needed}</Badge> : null}
        <span className="shrink-0 text-xs text-muted-foreground">{pc.ready(count)}</span>
      </button>
    );
  }
  return (
    <div
      data-prepare={keyOf(item)}
      data-open=""
      className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-sm ring-1 ring-primary/25 animate-in fade-in slide-in-from-top-1 duration-200 ease-enter"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{word}</h2>
        {item.needed ? <Badge variant={count === 0 ? "warning" : "secondary"}>{pc.needed}</Badge> : null}
        <span className="ml-auto text-xs text-muted-foreground">{pc.ready(count)}</span>
      </div>
      <p className="text-sm text-muted-foreground text-pretty">{item.guide}</p>
      <RelevantHere item={item} />
      <div className="flex flex-wrap items-center gap-2">
        <AddOne item={item} onAdded={onDone} />
        <Button type="button" variant="ghost" onClick={onDone}>
          {count > 0 ? <Check /> : <SkipForward />}
          {count > 0 ? pc.haveWhatINeed : pc.skip}
        </Button>
      </div>
    </div>
  );
}

/** What already exists that is relevant to the idea, so a person sees it
 * is there before adding another. */
function RelevantHere({ item }: { item: Item }) {
  const { matches } = useRelevant(item.kind, item.level);
  if (matches.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{pc.relevant}:</span>
      {matches.map((m, n) => (
        <span key={m.id} className="font-medium">
          {m.name}
          {n < matches.length - 1 ? "," : ""}
        </span>
      ))}
    </p>
  );
}

/** Adding one, with only what the record requires (engine TAXONOMY.md D34):
 * an outcome placed in the tree, an indicator with what defines it, a
 * programme on its own page (its aim has parts), anything else in the
 * shortest form. */
function AddOne({ item, onAdded }: { item: Item; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const tree = useGoalTree();
  if (item.kind === "Programme") {
    return (
      <Button asChild variant="outline">
        <Link to="/programmes/new">
          <Plus />
          {pc.define}
        </Link>
      </Button>
    );
  }
  const label = item.kind === "Operation" ? pc.plannedService : pc.add;
  // A goal is placed in the page, on the tree, not in a dialog over it.
  if (open && item.kind === "Goal") {
    return (
      <div className="basis-full">
        <PlaceGoalForm
          level={(item.level ?? "objective") as "outcome" | "objective"}
          fixedLevel
          name=""
          tree={tree.data}
          onDone={(id) => (setOpen(false), id ? onAdded() : undefined)}
        />
      </div>
    );
  }
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Plus />
        {label}
      </Button>
      {item.kind === "KPI" ? (
        <KPIAddDialog open={open} onOpenChange={setOpen} onAdded={() => (setOpen(false), onAdded())} />
      ) : item.kind !== "Goal" ? (
        <SheetAddDialog
          kind={item.kind}
          open={open}
          onOpenChange={setOpen}
          minimal={{ reason: pc.reason }}
          preset={item.kind === "Operation" ? { status: "planned" } : undefined}
          onAdded={() => (setOpen(false), onAdded())}
        />
      ) : null}
    </>
  );
}
