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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { nameFrom } from "@/surfaces/home/flows";
import { KPIAddDialog } from "@/kpis/KPIAddDialog";
import { useGoalTree } from "@/surfaces/goals/api";
import { PlaceGoalForm } from "@/surfaces/goals/PlaceGoal";
import { SheetAddDialog } from "@/surfaces/sheet/InlineSheetAdd";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { RecordPreview } from "@/records/RecordPreview";

const pc = copy.prepare;
const projectRoute = getRouteApi("/projects/prepare");

/** The kinds whose walks say what to prepare. */
export type PreparedKind = "Project" | "Programme" | "Portfolio";

/** Preparing a project, or a component of one. */
export function PreparePage() {
  return <Prepare kind="Project" partOf={projectRoute.useSearch().partOf} />;
}

const programmeRoute = getRouteApi("/programmes/prepare");
const portfolioRoute = getRouteApi("/portfolios/prepare");

/** Preparing a programme. */
export function PrepareProgrammePage() {
  return <Prepare kind="Programme" idea={programmeRoute.useSearch().idea} />;
}

/** Preparing a portfolio. */
export function PreparePortfolioPage() {
  return <Prepare kind="Portfolio" idea={portfolioRoute.useSearch().idea} />;
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
export function Prepare({ kind, partOf, idea: typed }: { kind: PreparedKind; partOf?: boolean; idea?: string }) {
  const navigate = useNavigate();
  const items = ITEMS[kind];
  // What was typed before choosing, where nothing is kept yet.
  const [state, setState] = useState(() => {
    const kept = load(kind);
    return typed && !kept.idea.trim() ? { ...kept, idea: typed } : kept;
  });
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
    const named = state.idea.trim() ? { name: nameFrom(state.idea) } : {};
    if (kind === "Programme") return void navigate({ to: "/programmes/new", search: named });
    if (kind === "Portfolio") return void navigate({ to: "/portfolios/new", search: named });
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

/** What already exists for an item: the records of its kind, or the goals
 * at its level (a portfolio's: goals and objectives, never outcomes). */
function useExisting(i: Item): { id: string; name: string }[] {
  const refs = useReferenceOptions(i.kind === "Goal" ? "Team" : i.kind);
  const tree = useGoalTree();
  return useMemo(() => {
    if (i.kind !== "Goal") return (refs.data?.options ?? []).map((o) => ({ id: o.value, name: o.label }));
    const out: { id: string; name: string }[] = [];
    const walk = (ns: { id: string; name: string; level: string; children?: unknown[] }[]) => {
      for (const node of ns) {
        if (i.level ? node.level === i.level : node.level !== "outcome") out.push({ id: node.id, name: node.name });
        walk((node.children ?? []) as never);
      }
    };
    walk((tree.data?.nodes ?? []) as never);
    walk((tree.data?.unplaced ?? []) as never);
    return out;
  }, [i, refs.data, tree.data]);
}

function PrepareRow({ item, isOpen, seen, onOpen, onDone }: { item: Item; isOpen: boolean; seen: boolean; onOpen: () => void; onDone: () => void }) {
  const existing = useExisting(item);
  const count = existing.length;
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
      <Existing kind={item.kind} what={word} records={existing} />
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

/** What is already defined, to read before adding another: each one
 * opens in place, the record as its own page shows it, and a long list
 * narrows as a name is typed. */
function Existing({ kind, what, records }: { kind: string; what: string; records: { id: string; name: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  if (records.length === 0) return null;
  const shown = records.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const first = shown.slice(0, LIST);
  return (
    <section className="flex flex-col gap-2" aria-label={pc.existing} data-slot="prepare-existing">
      <p className="text-xs font-medium text-muted-foreground">{pc.existing}</p>
      {records.length > LIST ? (
        <Input value={q} onChange={(e) => setQ(e.target.value)} aria-label={pc.existingFilter(what.toLowerCase())} className="h-8 sm:max-w-64" />
      ) : null}
      <ul className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/10">
        {first.map((r) => {
          const on = open === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-expanded={on}
                onClick={() => setOpen(on ? null : r.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-150 ease-standard hover:bg-muted/60"
              >
                <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${on ? "rotate-90" : ""}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
              </button>
              {on ? (
                <div className="border-t bg-muted/30 px-3 py-3 animate-in fade-in duration-150">
                  <RecordPreview kind={kind} id={r.id} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="text-xs text-muted-foreground">{pc.existingNoMatch}</p> : null}
      {shown.length > LIST ? <p className="text-xs text-muted-foreground">{pc.existingMore(shown.length - LIST)}</p> : null}
    </section>
  );
}

/** How many are listed before the list asks to be narrowed. */
const LIST = 8;

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
