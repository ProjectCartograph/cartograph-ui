import { useMemo, useState, type ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { stringify as stringifyYAML } from "yaml";
import { ArrowLeft, ArrowRight, Check, PencilLine, Plus, Sparkles } from "lucide-react";

import { aliasFor } from "@/alias";
import { useClient } from "@/client/context";
import { ChipPicker, type ChipItem } from "@/components/ChipPicker";
import { Suggested, WorkTextProvider } from "@/components/relevance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { useGoalTree } from "@/surfaces/goals/api";
import { PlaceGoal } from "@/surfaces/goals/PlaceGoal";
import { slugify } from "@/surfaces/sheet/schema";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { ProjectManifest } from "../types";

const sc = copy.start;

/** What was named here, and what was named this moment. */
interface Marks {
  newIds: Set<string>;
  fresh: string | null;
}

/** A record named in passing while starting the project. */
interface Created {
  kind: "Gap" | "Goal" | "BeneficiaryGroup" | "Team";
  id: string;
  name: string;
}

const ALL_STEPS = ["about", "gaps", "goals", "groups", "team", "details", "ready"] as const;
type Step = (typeof ALL_STEPS)[number];

/** An id from a name that no existing record of the kind holds. */
function freeId(name: string, taken: Set<string>): string {
  const base = slugify(name) || "record";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** A project's name from what it is about: its first few words. */
function nameFrom(about: string): string {
  const first = about.trim().split(/(?<=[.!?])\s|\n/)[0] ?? "";
  const words = first.replace(/[.!?]+$/, "").split(/\s+/).slice(0, 8).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Starting a project, as New starts anything: one question at a time on one
 * page. What it is about, the gaps it addresses, the outcomes it serves and
 * who it is for; each picked from what the workspace holds, the relevant
 * first (engine ADR 0023), or named in place when it is not there. Nothing
 * is defined in full here: a gap, an outcome or a group named in passing
 * holds its name (an outcome its place in the tree too), and the walk asks
 * for the rest where the project first shows it. Every question can be
 * skipped. The graph stays a DAG: the project names its gaps, outcomes and
 * groups, and nothing named here names the project.
 */
export function StartProject() {
  const navigate = useNavigate();
  const client = useClient();
  const [step, setStep] = useState<Step>("about");
  const [forward, setForward] = useState(true);
  const [about, setAbout] = useState("");
  const [gaps, setGaps] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [team, setTeam] = useState("");
  // What was named in passing here, to fill in once the project is saved.
  const [created, setCreated] = useState<Created[]>([]);
  // What has been filled in, so going back and forth asks it once.
  const [filled, setFilled] = useState<Set<string>>(new Set());
  // Everything named here is marked as new while the flow lasts, and the
  // one named this moment sparkles (components/Sparkle).
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<string | null>(null);
  const markNew = (id: string) => {
    setNewIds((prev) => new Set(prev).add(id));
    setFresh(id);
    setTimeout(() => setFresh((f) => (f === id ? null : f)), 1200);
  };
  const noteCreated = (c: Created) => {
    setCreated((prev) => [...prev, c]);
    markNew(c.id);
  };
  const marks = { newIds, fresh };
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // What was named in passing and is still chosen is filled in before
  // the project is named: naming it is the commit, and comes last.
  const toFill = created.filter((c) => c.kind !== "Team" && (c.kind === "Gap" ? gaps : c.kind === "Goal" ? goals : groups).includes(c.id) && !filled.has(c.id));
  const STEPS = ALL_STEPS.filter((s) => s !== "details" || toFill.length > 0 || step === "details");
  const at = STEPS.indexOf(step);
  const go = (to: Step) => {
    setForward(STEPS.indexOf(to) > at);
    setStep(to);
  };
  const chosen = { gaps, goals, groups, team: team ? [team] : [] } as const;
  // The name is the person's to give: what it is about is shown in the
  // field as a cue, never put in it.
  const projectName = name;

  async function start() {
    setSaving(true);
    setFailed(false);
    try {
      const existing = new Set(((await client.list("Project")) as { id: string }[]).map((p) => p.id));
      const id = freeId(projectName, existing);
      const body: ProjectManifest = {
        apiVersion: "cartograph/v1",
        kind: "Project",
        metadata: { id, name: projectName.trim(), alias: aliasFor(projectName) },
        spec: {
          team,
          summary: {
            about: about.trim().slice(0, 300),
            idea: about.trim().slice(0, 1000),
            beneficiaries: groups.map((group) => ({ group })),
            problems: [{ problem: {}, change: {}, ...(gaps.length ? { gaps: gaps.map((gap) => ({ gap })) } : {}) }],
          },
          ...(goals.length ? { alignment: { goals } } : {}),
        },
      };
      await client.saveWorking("Project", id, stringifyYAML(body));
      void navigate({ to: "/projects/$id/initiation/goals", params: { id } });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <WorkTextProvider text={about}>
      <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col gap-8 pt-[6vh] pb-12" data-cartograph-region="start-project">
        <Progress steps={STEPS} at={at} onGo={(s) => (STEPS.indexOf(s) <= at || about.trim() ? go(s) : undefined)} />

        <div
          key={step}
          className={`flex flex-col gap-6 animate-in fade-in duration-300 ease-enter ${forward ? "slide-in-from-right-6" : "slide-in-from-left-6"}`}
          data-step={step}
        >
          {step === "about" ? (
            <Question title={sc.aboutQuestion} hint={sc.aboutHint} lead={sc.lead}>
              <Textarea
                value={about}
                onChange={(e) => setAbout(e.target.value.slice(0, 1000))}
                rows={4}
                autoFocus
                aria-label={sc.aboutQuestion}
                data-cartograph-field="/spec/summary/about"
                className="text-base"
              />
            </Question>
          ) : step === "gaps" ? (
            <Question title={sc.gapsQuestion} hint={sc.gapsHint}>
              <Pick kind="Gap" word="gap" words="gaps" selected={gaps} onChange={setGaps} onCreated={noteCreated} marks={marks} />
            </Question>
          ) : step === "goals" ? (
            <Question title={sc.goalsQuestion} hint={sc.goalsHint}>
              <PickOutcomes gaps={gaps} selected={goals} onChange={setGoals} onCreated={noteCreated} marks={marks} />
            </Question>
          ) : step === "groups" ? (
            <Question title={sc.groupsQuestion} hint={sc.groupsHint}>
              <Pick kind="BeneficiaryGroup" word="group" words="groups" selected={groups} onChange={setGroups} onCreated={noteCreated} marks={marks} />
            </Question>
          ) : step === "team" ? (
            <Question title={sc.teamQuestion} hint={sc.teamHint}>
              {/* One team: picking another replaces it. */}
              <Pick kind="Team" word="team" words="teams" selected={team ? [team] : []} onChange={(next) => setTeam(next.filter((t) => t !== team)[0] ?? "")} onCreated={(c) => markNew(c.id)} marks={marks} />
            </Question>
          ) : step === "details" ? (
            <FillIn
              items={toFill}
              outcomes={goals}
              onFilled={(id) => setFilled((prev) => new Set(prev).add(id))}
              onDone={() => go("ready")}
            />
          ) : (
            <Question title={sc.readyQuestion} hint={sc.readyHint}>
              <div className="flex flex-col gap-2">
                <label htmlFor="start-name" className="text-sm font-medium">
                  {sc.nameLabel}
                </label>
                <Input
                  id="start-name"
                  data-cartograph-field="/metadata/name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 160))}
                  placeholder={nameFrom(about)}
                  autoFocus
                />
              </div>
              <Summary chosen={chosen} newIds={newIds} />
              {failed ? <p className="text-sm text-destructive" role="alert">{sc.failed}</p> : null}
            </Question>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="lg" onClick={() => go(STEPS[at - 1])} disabled={at === 0} className={at === 0 ? "invisible" : ""}>
            <ArrowLeft />
            {sc.back}
          </Button>
          {step === "ready" ? (
            <Button type="button" size="lg" onClick={() => void start()} disabled={saving || !projectName.trim()}>
              {sc.start}
              <ArrowRight />
            </Button>
          ) : step === "details" ? null : (
            <Button type="button" size="lg" onClick={() => go(STEPS[at + 1])} disabled={step === "about" && !about.trim()}>
              {step !== "about" && chosen[step as keyof typeof chosen].length === 0 ? sc.skip : sc.next}
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </WorkTextProvider>
  );
}

/** Where the person is: every question, the one in hand marked, those
 * passed open to return to. */
function Progress({ steps, at, onGo }: { steps: Step[]; at: number; onGo: (s: Step) => void }) {
  return (
    <ol className="flex items-center gap-2" aria-label={sc.readyQuestion}>
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onGo(s)}
            aria-current={i === at ? "step" : undefined}
            className="flex flex-col gap-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <span className={`h-1 rounded-full transition-colors duration-300 ease-standard ${i <= at ? "bg-primary" : "bg-muted"}`} />
            <span className={`text-xs ${i === at ? "font-medium text-foreground" : "text-muted-foreground"}`}>{sc.steps[s]}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Question({ title, hint, lead, children }: { title: string; hint: string; lead?: string; children: ReactNode }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        {lead ? <p className="text-sm font-medium text-primary/80 text-pretty">{lead}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-muted-foreground text-pretty">{hint}</p>
      </div>
      {children}
    </>
  );
}

/** A register to pick from: the relevant first, then everything, and a
 * new one named in place when it is not there. */
function Pick({
  kind,
  word,
  words,
  selected,
  onChange,
  onCreated,
  marks,
}: {
  kind: string;
  word: string;
  words: string;
  selected: string[];
  onChange: (next: string[]) => void;
  onCreated?: (c: Created) => void;
  marks: Marks;
}) {
  const client = useClient();
  const queryClient = useQueryClient();
  const refs = useReferenceOptions(kind);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const items = useMemo<ChipItem[]>(
    () => (refs.data?.options ?? []).map((o) => ({ id: o.value, label: o.label, isNew: marks.newIds.has(o.value), fresh: marks.fresh === o.value })),
    [refs.data, marks],
  );

  async function add(newName: string) {
    const id = freeId(newName, new Set(items.map((i) => i.id)));
    await client.saveVersion(kind, id, { apiVersion: "cartograph/v1", kind, metadata: { id, name: newName }, spec: {} }, sc.reason);
    await queryClient.invalidateQueries({ queryKey: ["sheet-ref-options", kind] });
    onCreated?.({ kind: kind as Created["kind"], id, name: newName });
    onChange([...selected, id]);
  }

  return (
    <Choose words={words} word={word} hasAny={items.length > 0} onAdd={add}>
      <Suggested kind={kind} selected={selected} onPick={toggle} />
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{sc.all}</p>
        <ChipPicker items={items} selected={selected} onToggle={toggle} placeholder={sc.searchPlaceholder} empty={sc.none(sc.words[words])} slot={`start-${kind}`} />
      </div>
    </Choose>
  );
}

/** Outcomes: those the chosen gaps already name first (the link runs from
 * the gap to the outcome, so it is already in the graph), then the
 * relevant, then the whole tree, and a new one placed in the tree. */
function PickOutcomes({
  gaps,
  selected,
  onChange,
  onCreated,
  marks,
}: {
  gaps: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onCreated?: (c: Created) => void;
  marks: Marks;
}) {
  const client = useClient();
  const tree = useGoalTree();
  const [placing, setPlacing] = useState<string | null>(null);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const gapDocs = useQueries({
    queries: gaps.map((id) => ({ queryKey: ["start-gap", id], queryFn: () => client.get("Gap", id) })),
  });
  const named = new Set(
    gapDocs.flatMap((q) => ((q.data as unknown as { manifest?: { spec?: { outcomes?: string[] } } })?.manifest?.spec?.outcomes ?? [])),
  );
  const chips = useMemo<ChipItem[]>(() => {
    const out: ChipItem[] = [];
    for (const goal of tree.data?.nodes ?? []) {
      for (const objective of goal.children ?? []) {
        for (const outcome of objective.children ?? []) {
          if (outcome.level === "outcome")
            out.push({ id: outcome.id, label: outcome.name, group: goal.name, tag: objective.name, isNew: marks.newIds.has(outcome.id), fresh: marks.fresh === outcome.id });
        }
      }
    }
    return out;
  }, [tree.data, marks]);
  const fromGaps = chips.filter((c) => named.has(c.id));

  return (
    <>
    <Choose words="goals" word="goal" hasAny={chips.length > 0} onAdd={async (n) => setPlacing(n)}>
      {fromGaps.length > 0 ? (
        <div className="flex flex-col gap-1.5" data-slot="from-gaps">
          <p className="text-xs text-muted-foreground">{sc.fromGaps}</p>
          <ul className="flex flex-wrap gap-1.5">
            {fromGaps.map((c) => {
              const on = selected.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ring-1 transition-colors duration-150 ease-standard ${on ? "bg-primary/10 font-medium text-primary ring-primary/30" : "ring-foreground/15 hover:bg-muted"}`}
                  >
                    {on ? <Check className="size-3.5" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
                    {c.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <Suggested kind="Goal" level="outcome" selected={selected} onPick={toggle} />
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{sc.all}</p>
        <ChipPicker items={chips} selected={selected} onToggle={toggle} placeholder={sc.searchPlaceholder} empty={sc.none(sc.words.goals)} slot="start-goals" />
      </div>
    </Choose>

      {placing !== null ? (
        <PlaceGoal
          level="outcome"
          name={placing}
          tree={tree.data}
          onDone={(id) => {
            const named = placing;
            setPlacing(null);
            if (id) {
              onCreated?.({ kind: "Goal", id, name: named ?? id });
              onChange([...selected, id]);
            }
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Two ways to answer, kept apart: choosing from what exists (the relevant
 * first), or naming a new one. When nothing exists yet, only the second.
 */
function Choose({ words, word, hasAny, onAdd, children }: { words: string; word: string; hasAny: boolean; onAdd: (name: string) => Promise<void>; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {hasAny ? (
        <section className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-slot="choose-existing">
          <h2 className="text-sm font-semibold">{sc.existing(sc.words[words])}</h2>
          {children}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">{sc.none(sc.words[words])}</p>
      )}
      {hasAny ? (
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          {sc.or}
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}
      <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-slot="name-new-section">
        <h2 className="text-sm font-semibold">{sc.nameNew(sc.words[word])}</h2>
        <NameNew label={sc.nameNew(sc.words[word])} onAdd={onAdd} />
      </section>
    </div>
  );
}

/** A name, typed and added: the one thing asked of a record named in
 * passing. */
function NameNew({ label, onAdd }: { label: string; onAdd: (name: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    try {
      await onAdd(v);
      setValue("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      data-slot="name-new"
    >
      <Input value={value} onChange={(e) => setValue(e.target.value.slice(0, 160))} placeholder={label} aria-label={label} />
      <Button type="submit" variant="outline" disabled={busy || !value.trim()}>
        <Plus />
        {sc.add}
      </Button>
    </form>
  );
}

/** What has been chosen, by name, before the project is started. */
function Summary({ chosen, newIds }: { chosen: { gaps: readonly string[]; goals: readonly string[]; groups: readonly string[] }; newIds: Set<string> }) {
  const gaps = useReferenceOptions("Gap");
  const groups = useReferenceOptions("BeneficiaryGroup");
  const goals = useReferenceOptions("Goal");
  const names = { gaps: gaps.data?.names, goals: goals.data?.names, groups: groups.data?.names };
  return (
    <dl className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 text-sm">
      {(["gaps", "goals", "groups"] as const).map((k) => (
        <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="w-24 shrink-0 text-muted-foreground">{sc.chosen[k]}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {chosen[k].length
              ? chosen[k].map((id) => (
                  <span key={id} data-new={newIds.has(id) ? "" : undefined} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${newIds.has(id) ? "cartograph-new" : ""}`}>
                    {newIds.has(id) ? <Sparkles className="size-3.5 text-new" aria-label={copy.common.isNew} /> : null}
                    {names[k]?.get(id) ?? id}
                  </span>
                ))
              : sc.nothingChosen}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Details: what was named in passing, filled in one at a time, before the
 * project is named, with what defines each. A gap is its two states and the outcomes
 * that would close it (the link runs from the gap to the outcome, so the
 * graph stays a DAG); an outcome is what will be true; a group is who is
 * in it. Each is saved as it is left.
 */
function FillIn({ items, outcomes, onFilled, onDone }: { items: Created[]; outcomes: string[]; onFilled: (id: string) => void; onDone: () => void }) {
  // The first not yet filled; the list shortens as each is saved.
  const item = items[0];
  if (!item) return null;
  const last = items.length === 1;
  return (
    <div className="flex flex-col gap-6" data-cartograph-region="fill-in">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-primary/80 text-pretty">{sc.fillTitle}</p>
        <p className="text-xs text-muted-foreground">{sc.fillLeft(items.length)}</p>
      </div>
      <div key={item.id} className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-6 duration-300 ease-enter">
        <FillOne
          item={item}
          outcomes={outcomes}
          last={last}
          onSaved={() => {
            onFilled(item.id);
            if (last) onDone();
          }}
        />
      </div>
    </div>
  );
}

function FillOne({ item, outcomes, last, onSaved }: { item: Created; outcomes: string[]; last: boolean; onSaved: () => void }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const goalNames = useReferenceOptions("Goal");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [closes, setCloses] = useState<string[]>(outcomes);
  // A typo in a name is often seen only here: it can be put right.
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const ready = item.kind === "Gap" ? !!a.trim() && !!b.trim() : !!a.trim();

  async function save() {
    setSaving(true);
    setFailed(false);
    try {
      const view = (await client.get(item.kind, item.id)) as unknown as { manifest: { spec?: Record<string, unknown> } & Record<string, unknown> };
      const spec = { ...(view.manifest.spec ?? {}) };
      if (item.kind === "Gap") {
        spec.current = a.trim();
        spec.desired = b.trim();
        if (closes.length) spec.outcomes = closes;
      } else if (item.kind === "Goal") {
        spec.objective = a.trim();
      } else {
        spec.description = a.trim();
      }
      const metadata = { ...(view.manifest.metadata as Record<string, unknown>), name: name.trim() || item.name };
      await client.saveVersion(item.kind, item.id, { ...view.manifest, metadata, spec }, sc.reason);
      await queryClient.invalidateQueries({ queryKey: ["finish", item.kind, item.id] });
      onSaved();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  const field = (id: string, label: string, hint: string, value: string, set: (v: string) => void, max: number, focus = false) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-lg font-semibold tracking-tight">
        {label}
      </label>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Textarea id={id} value={value} onChange={(e) => set(e.target.value.slice(0, max))} rows={2} autoFocus={focus} />
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {sc.fillKind[item.kind]}
          <span className="cartograph-new inline-flex items-center gap-1 rounded-full px-2 py-0.5 normal-case tracking-normal text-foreground">
            <Sparkles className="size-3.5 text-new" aria-hidden="true" />
            {copy.common.isNew}
          </span>
        </p>
        <EditableName value={name} onChange={setName} />
      </div>
      {item.kind === "Gap" ? (
        <>
          {field("fill-current", sc.gapCurrent, sc.gapCurrentHint, a, setA, 200, true)}
          {field("fill-desired", sc.gapDesired, sc.gapDesiredHint, b, setB, 200)}
          {outcomes.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold tracking-tight">{sc.gapOutcomes}</p>
              <ul className="flex flex-wrap gap-1.5">
                {outcomes.map((o) => {
                  const on = closes.includes(o);
                  return (
                    <li key={o}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setCloses(on ? closes.filter((x) => x !== o) : [...closes, o])}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ring-1 transition-colors duration-150 ease-standard ${on ? "bg-primary/10 font-medium text-primary ring-primary/30" : "ring-foreground/15 hover:bg-muted"}`}
                      >
                        {on ? <Check className="size-3.5" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
                        {goalNames.data?.names.get(o) ?? o}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : item.kind === "Goal" ? (
        field("fill-outcome", sc.outcomeStatement, sc.outcomeHint, a, setA, 120, true)
      ) : (
        field("fill-group", sc.groupDescription, sc.groupHint, a, setA, 240, true)
      )}
      {failed ? <p className="text-sm text-destructive" role="alert">{sc.failed}</p> : null}
      <div className="flex justify-end">
        <Button type="button" size="lg" onClick={() => void save()} disabled={!ready || saving}>
          {last ? sc.fillDone : sc.fillNext}
          <ArrowRight />
        </Button>
      </div>
    </>
  );
}

/**
 * A name shown as a heading that becomes a field when clicked, so a typo
 * seen only now is put right where it is seen.
 */
function EditableName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <Input
        autoFocus
        aria-label={sc.editName}
        data-cartograph-field="/metadata/name"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 160))}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") setEditing(false);
        }}
        className="h-auto py-1 text-2xl font-semibold tracking-tight md:text-3xl"
      />
    );
  }
  return (
    <h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={sc.editName}
        className="group inline-flex items-center gap-2 rounded-md text-left text-3xl font-semibold tracking-tight text-balance outline-none transition-colors duration-150 ease-standard hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {value}
        <PencilLine className="size-5 shrink-0 text-muted-foreground opacity-60 transition-opacity duration-150 group-hover:opacity-100" aria-hidden="true" />
      </button>
    </h1>
  );
}
