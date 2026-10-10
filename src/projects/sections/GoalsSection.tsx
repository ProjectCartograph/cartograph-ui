import { useMemo, useState } from "react";
import { Blocks, BriefcaseBusiness, CornerLeftUp, Footprints, Plus, TriangleAlert, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { FinishDetails } from "@/projects/FinishDetails";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { ChipPicker, type ChipItem } from "@/components/ChipPicker";
import { FieldHeading, Help } from "@/components/guidance";
import { VocabMark } from "@/components/vocab";
import { useClient } from "@/client/context";
import { orUndefined } from "@/client/port";
import { copy, plusNoun } from "@/copy";
import { useGoalTree } from "@/surfaces/goals/api";

import { ObjectiveEditor } from "../ObjectiveEditor";
import { KeyResultCard } from "@/surfaces/goals/KeyResultCard";
import { KeyResultDialog } from "@/surfaces/goals/KeyResultDialog";
import type { KeyResult } from "@/surfaces/goals/types";
import { DirectorySelect } from "@/surfaces/sheet/DirectorySelect";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { Suggested } from "@/components/relevance";
import { Textarea } from "@/components/ui/textarea";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useSectionAutosave, useProjectStore } from "../store";
import { ComponentsTable, dependentsOf, KIND_ICON, Marks, useComponentGraph } from "../components/ComponentsTable";
import { RelationRow } from "../components/Relations";
import { seg } from "../field";

const gc = copy.projects.goals;
const cc = copy.projects.components;


/** What the project is about, in a sentence a newcomer would follow: the
 * schema's limit, shown as it is reached. */
const ABOUT_MAX = 300;

/**
 * One question of a chain, compact: the question and a yes or no beside
 * it, and on yes, what it asks for beneath. Answered, the next appears.
 */

/**
 * Which goals each programme serves, by programme id.
 *
 * The Align step needs this to tell a goal inside the chosen programmes
 * from one beyond them, and to say when a programme has been claimed
 * without a goal to prove it. Read once for the whole step rather than
 * once per programme.
 */
function useProgrammeGoals() {
  const client = useClient();
  return useQuery({
    queryKey: ["programme-goals"],
    queryFn: async () => {
      const items = await client.list("Programme");
      const out = new Map<string, string[]>();
      await Promise.all(
        items.map(async (summary) => {
          const view = await orUndefined(client.get("Programme", summary.id));
          const spec = (view as unknown as { manifest?: { spec?: { goals?: string[] } } })?.manifest?.spec;
          out.set(summary.id, spec?.goals ?? []);
        }),
      );
      return out;
    },
    staleTime: 30_000,
  });
}

interface KPIRow {
  id: string;
  name: string;
}

function useKPIList() {
  const client = useClient();
  return useQuery({
    queryKey: ["project-aim-kpis"],
    queryFn: async () => (await client.list("KPI")) as KPIRow[],
  });
}

/** A block of the step, with its own heading and, only where a rule needs
 * saying, one short line under it. */
function Block({
  title,
  hint,
  action,
  region,
  children,
}: {
  /** The region's key, for a pointer over it. */
  region: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3" data-cartograph-region={region}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-1">
          <h2 className="text-base font-semibold">{title}</h2>
          <Help label={title} hint={hint} />
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Align: which goals this project serves, who carries it, and which
 * programme it belongs to.
 *
 * The goal tree used to be on screen here with a drop zone beside it. Two
 * of its three levels can never be picked by a project, and the panel
 * beside it repeated the picks, so most of the screen was scenery. The
 * goals are chips now (Programme Lead, 2026-09-26) — but grouped under
 * their pillar and their strategic area, after the same day's correction:
 * dropping the levels a project cannot pick is not the same as dropping
 * the structure, and without it a person has nowhere to place the goal
 * they are looking at, which is what Align is for. The two levels are
 * headings, so the ancestry is read once per branch instead of repeated
 * on every chip.
 */
export function AlignmentSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const treeQuery = useGoalTree();
  const { data: teams, isLoading: teamsLoading } = useReferenceOptions("Team");
  const { data: programmeOptions } = useReferenceOptions("Programme");
  const { data: portfolioOptions } = useReferenceOptions("Portfolio");
  const { data: programmeGoals } = useProgrammeGoals();

  const self = { kind: "Project" as const, id: store.id };
  const graph = useComponentGraph();
  const goals = store.spec.alignment?.goals ?? [];
  const components = store.spec.components ?? [];
  // The programmes that list this project, and any an older definition
  // named here: the outcomes they serve are offered first.
  const programmes = [
    ...new Set([...(store.spec.alignment?.programmes ?? []), ...dependentsOf(graph.data, self).filter((n) => n.kind === "Programme").map((n) => n.id)]),
  ];
  // An older definition that made this project part of another: its goals
  // are the parent's (TAXONOMY.md D15), until the person removes it.
  const parent = store.spec.alignment?.partOf;
  const portfolios = store.spec.alignment?.portfolios ?? [];
  const partOf = parent ? "project" : "programmes";

  // Each goal's parent, from the tree: a programme may be judged on an aim
  // at any level, and an outcome beneath it serves it (TAXONOMY.md D24,
  // D25), as the engine's goals-programme-membership check reads it.
  const parentOf = useMemo(() => {
    const m = new Map<string, string>();
    const walk = (nodes: { id: string; children?: unknown[] }[], parent?: string) => {
      for (const n of nodes) {
        if (parent) m.set(n.id, parent);
        walk((n.children ?? []) as { id: string; children?: unknown[] }[], n.id);
      }
    };
    walk(treeQuery.data?.nodes ?? []);
    return m;
  }, [treeQuery.data]);
  const serves = (goal: string, aim: string) => {
    for (let at: string | undefined = goal, i = 0; at && i < 64; at = parentOf.get(at), i++) if (at === aim) return true;
    return false;
  };

  // Which outcomes the chosen programmes already serve. A project proves it
  // belongs to a programme by serving one of its aims, so those outcomes
  // are offered first and the rest are marked as reaching outside them
  // (Programme Lead, 2026-09-27).
  const programmeAims = programmes.flatMap((id) => programmeGoals?.get(id) ?? []);

  // Each programme this project names must have one of its aims served by
  // an outcome picked; until it does, the claim is unproven.
  const unproven = programmes.filter((id) => !(programmeGoals?.get(id) ?? []).some((aim) => goals.some((g) => serves(g, aim))));


  // Every outcome in the tree, in tree order, each carrying the branch it
  // sits on: the goals group them, the objectives subgroup them.
  const chips = useMemo<ChipItem[]>(() => {
    const out: ChipItem[] = [];
    for (const goal of treeQuery.data?.nodes ?? []) {
      for (const objective of goal.children ?? []) {
        for (const outcome of objective.children ?? []) {
          if (outcome.level !== "outcome") continue;
          out.push({
            id: outcome.id,
            label: outcome.name,
            group: goal.name,
            tag: objective.name,
            title: `${goal.name} / ${objective.name}`,
          });
        }
      }
    }
    return out;
  }, [treeQuery.data]);
  const withinProgrammes = new Set(chips.filter((c) => programmeAims.some((aim) => serves(c.id, aim))).map((c) => c.id));

  // Split, not filtered: a project may serve a goal none of its
  // programmes serve, so the rest stay pickable under their own heading
  // rather than disappearing.
  const within = chips.filter((c) => withinProgrammes.has(c.id));
  const beyond = chips.filter((c) => !withinProgrammes.has(c.id));

  function toggleGoal(goalId: string) {
    store.updateSpec((s) => {
      const current = s.alignment?.goals ?? [];
      const next = current.includes(goalId) ? current.filter((g) => g !== goalId) : [...current, goalId];
      return { ...s, alignment: { ...s.alignment, goals: next } };
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* What it is about, and where it sits, kept compact: one sentence,
          then a question at a time, each opening the next once answered.
          Asked first: everything suggested below is ranked against them
          (engine docs/adr/0023). */}
      <section className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-cartograph-region="about">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <FieldHeading label={copy.projects.align.aboutLabel} hint={copy.projects.align.aboutHint} htmlFor="project-about" />
            <Button asChild variant="ghost" size="sm">
              <Link to="/projects/start" search={{ from: store.id }} data-slot="walk-again">
                <Footprints aria-hidden="true" />
                {gc.walkAgain}
              </Link>
            </Button>
          </div>
          <Textarea
            id="project-about"
            data-cartograph-field="/spec/summary/about"
            value={store.spec.summary.about ?? ""}
            onChange={(e) => store.updateSpec((s) => ({ ...s, summary: { ...s.summary, about: e.target.value.slice(0, ABOUT_MAX) || undefined } }))}
            maxLength={ABOUT_MAX}
            rows={2}
            aria-describedby="project-about-count"
          />
          <span id="project-about-count" className={`self-end text-xs tabular-nums ${(store.spec.summary.about ?? "").length >= ABOUT_MAX ? "text-warning" : "text-muted-foreground"}`}>
            {gc.aboutCount((store.spec.summary.about ?? "").length, ABOUT_MAX)}
          </span>
          {store.spec.summary.idea ? (
            <details className="text-sm" data-region-idea>
              <summary className="cursor-pointer text-muted-foreground">{copy.common.yourIdea}</summary>
              <Textarea
                id="project-idea"
                data-cartograph-field="/spec/summary/idea"
                value={store.spec.summary.idea}
                onChange={(e) => store.updateSpec((s) => ({ ...s, summary: { ...s.summary, idea: e.target.value.slice(0, 1000) } }))}
                rows={3}
                className="mt-2"
                aria-label={copy.common.yourIdea}
              />
            </details>
          ) : null}
        </div>

        <div className="flex flex-col divide-y border-t pt-3" data-cartograph-region="part-of">
          <RelationRow
            slot="depends-on"
            icon={Blocks}
            label={cc.dependsOnLabel}
            hint={cc.dependsOnHint}
            empty={cc.dependsOnNone}
            addLabel={cc.add}
            addTitle={cc.addDependency}
            wide
            items={components.map((c) => {
              const node = graph.data?.nodes.find((n) => n.kind === c.kind && n.id === c.id);
              const name = node?.name ?? c.id;
              return {
                key: `${c.kind}/${c.id}`,
                name,
                icon: KIND_ICON[c.kind],
                title: c.why,
                marks: node ? <Marks node={node} /> : undefined,
                onRemove: () => store.updateSpec((s) => {
                  const next = (s.components ?? []).filter((x) => !(x.kind === c.kind && x.id === c.id));
                  return { ...s, components: next.length > 0 ? next : undefined };
                }),
                removeLabel: cc.removeDependency(name),
              };
            })}
            picker={
              <ComponentsTable
                from={self}
                value={components}
                onChange={(next) => store.updateSpec((s) => ({ ...s, components: next.length > 0 ? next : undefined }))}
              />
            }
          />
          <RelationRow
            slot="used-by"
            icon={CornerLeftUp}
            label={cc.usedBy}
            hint={cc.usedByHint}
            empty={cc.usedByNone}
            items={(graph.data?.edges ?? [])
              .filter((e) => e.to.kind === "Project" && e.to.id === store.id)
              .map((e) => {
                const node = graph.data?.nodes.find((n) => n.kind === e.from.kind && n.id === e.from.id);
                const name = node?.name ?? e.from.id;
                return {
                  key: `${e.from.kind}/${e.from.id}`,
                  name,
                  icon: KIND_ICON[e.from.kind],
                  title: e.legacy ? cc.declaredHere(name) : e.why,
                  marks: node ? <Marks node={node} /> : undefined,
                  // Only a link an older definition recorded here can be
                  // removed here; the rest belong to the work that lists it.
                  onRemove: e.legacy
                    ? () => store.updateSpec((s) => ({
                        ...s,
                        alignment: {
                          ...s.alignment,
                          ...(e.from.kind === "Project" ? { partOf: undefined } : { programmes: (s.alignment?.programmes ?? []).filter((x) => x !== e.from.id) }),
                        },
                      }))
                    : undefined,
                  removeLabel: cc.stopPartOf(name),
                };
              })}
          />
          <RelationRow
            slot="portfolios"
            icon={BriefcaseBusiness}
            label={gc.portfoliosLabel}
            hint={cc.portfoliosHint}
            empty={cc.portfoliosNone}
            addLabel={cc.add}
            addTitle={cc.addPortfolio}
            items={portfolios.map((id) => {
              const name = portfolioOptions?.names.get(id) ?? id;
              return {
                key: id,
                name,
                icon: BriefcaseBusiness,
                onRemove: () => store.updateSpec((s) => {
                  const next = (s.alignment?.portfolios ?? []).filter((x) => x !== id);
                  return { ...s, alignment: { ...s.alignment, portfolios: next.length > 0 ? next : undefined } };
                }),
                removeLabel: `${copy.projects.common.remove} ${name}`,
              };
            })}
            picker={
              <div className="flex flex-col gap-3">
                <Suggested
                  kind="Portfolio"
                  selected={portfolios}
                  onPick={(id) =>
                    store.updateSpec((s) => {
                      const cur = s.alignment?.portfolios ?? [];
                      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
                      return { ...s, alignment: { ...s.alignment, portfolios: next.length > 0 ? next : undefined } };
                    })
                  }
                />
                <ComboboxMultiple
                  options={portfolioOptions?.options ?? []}
                  value={portfolios}
                  onValueChange={(next) => store.updateSpec((s) => ({ ...s, alignment: { ...s.alignment, portfolios: next.length > 0 ? next : undefined } }))}
                  emptyText={copy.sheets.dialog.noMatches}
                  removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
                  aria-label={gc.portfoliosLabel}
                  data-cartograph-field="/spec/alignment/portfolios"
                />
              </div>
            }
          />
          {/* A programme that lists this project expects it to serve one
              of its aims. */}
          {unproven.length > 0 ? (
            <p className="flex items-center gap-1.5 pt-3 text-xs text-muted-foreground" data-slot="unproven-programmes">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              {gc.unprovenProgramme(unproven.map((id) => programmeOptions?.names.get(id) ?? id).join(", "))}
            </p>
          ) : null}
        </div>
      </section>

      {partOf === "project" && parent ? null : <Separator />}

      {partOf === "project" && parent ? null : treeQuery.isLoading ? <p className="text-sm text-muted-foreground">{copy.goals.home.loading}</p> : null}
      {treeQuery.isError ? <p className="text-sm text-destructive">{copy.goals.home.error}</p> : null}
      {treeQuery.data && !(partOf === "project" && parent) ? (
        <div className="flex flex-col gap-6" data-cartograph-region="goal-picker">
          <FinishDetails kind="Goal" ids={goals} />
          <Suggested kind="Goal" level="outcome" selected={goals} onPick={toggleGoal} />
          {programmes.length > 0 ? (
            <div className="flex flex-col gap-3">
              <FieldHeading label={gc.withinLabel} hint={gc.withinHint} />
              <ChipPicker
                slot="goal-chips"
                data-cartograph-field="/spec/alignment/goals"
                items={within}
                selected={goals}
                onToggle={toggleGoal}
                placeholder={gc.searchPlaceholder}
                empty={gc.noGoalsInProgramme}
                groupIcon={<VocabMark vocab="goalLevel" value="goal" className="size-3.5" decorative />}
                areaIcon={<VocabMark vocab="goalLevel" value="objective" className="size-3.5" decorative />}
                previewKind="Goal"
              />
            </div>
          ) : null}
          {/* Not hidden: a project can serve something its programmes do
              not, and hiding that would make the tree look smaller than
              it is. */}
          <div className="flex flex-col gap-3">
            <FieldHeading
              label={programmes.length > 0 ? gc.beyondLabel : gc.allGoalsLabel}
              hint={programmes.length > 0 ? gc.beyondHint : undefined}
            />
            <ChipPicker
              slot={programmes.length > 0 ? "goal-chips-beyond" : "goal-chips"}
              items={programmes.length > 0 ? beyond : chips}
              data-cartograph-field={programmes.length > 0 ? undefined : "/spec/alignment/goals"}
              selected={goals}
              onToggle={toggleGoal}
              placeholder={gc.searchPlaceholder}
              empty={gc.noGoalsMatch}
              groupIcon={<VocabMark vocab="goalLevel" value="goal" className="size-3.5" decorative />}
              areaIcon={<VocabMark vocab="goalLevel" value="objective" className="size-3.5" decorative />}
              previewKind="Goal"
            />
          </div>
        </div>
      ) : null}

      {/* Who carries it is a different question from what it serves, so it
          sits below a rule rather than running on from the last chip. */}
      <Separator />

      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label>{gc.teamLabel}</Label>
        <DirectorySelect
          data-cartograph-field="/spec/team"
          kind="Team"
          value={store.spec.team ?? ""}
          onValueChange={(v) => store.updateSpec((s) => ({ ...s, team: v }))}
          options={teams?.options ?? []}
          loading={teamsLoading}
          placeholder={gc.teamPlaceholder}
        />
      </div>
    </div>
  );
}

/**
 * Refine: what this project will actually move. The objective and its key
 * results used to sit under the goal tree on one long screen; they are
 * their own step now, so the question on screen is one question.
 */
export function MeasuresSection() {
  useSectionAutosave();
  const store = useProjectStore();
  const { data: kpis } = useKPIList();

  const [krDialog, setKrDialog] = useState<{ open: boolean; existing?: KeyResult }>({ open: false });
  const [addKpi, setAddKpi] = useState(false);
  const [suggestedKpi, setSuggestedKpi] = useState<string | undefined>(undefined);

  // How many goals this project aligned to, from the step before: the
  // objective editor marks an objective that names none of them.
  const goals = store.spec.alignment?.goals ?? [];
  const objective = store.spec.objectives?.[0] ?? { objective: "", keyResults: [] };
  const keyResults = objective.keyResults ?? [];

  function updateObjective(patch: Partial<typeof objective>) {
    store.updateSpec((s) => {
      const list = s.objectives && s.objectives.length > 0 ? [...s.objectives] : [{ objective: "", keyResults: [] }];
      list[0] = { ...list[0], ...patch };
      return { ...s, objectives: list };
    });
  }

  function saveKeyResult(kr: KeyResult) {
    const idx = keyResults.findIndex((x) => x.id === kr.id);
    const next = idx >= 0 ? keyResults.map((x, i) => (i === idx ? kr : x)) : [...keyResults, kr];
    updateObjective({ keyResults: next });
  }

  function removeKeyResult(krId: string) {
    updateObjective({ keyResults: keyResults.filter((x) => x.id !== krId) });
  }

  const kpiNames = new Map((kpis ?? []).map((k) => [k.id, k.name]));
  const namedKpis = store.spec.kpis ?? [];

  function removeKpi(idx: number) {
    store.updateSpec((sp) => ({ ...sp, kpis: (sp.kpis ?? []).filter((_, i) => i !== idx) }));
  }

    return (
    <div className="flex flex-col gap-8">
      <Block title={gc.objectiveTitle} region="objective">
        <ObjectiveEditor
          data-cartograph-field={`/spec/objectives/${seg(store.spec.objectives?.[0], 0)}/objective`}
          objective={objective.objective}
          alignedGoals={parent ? 1 : goals.length}
          onChange={(next) => updateObjective({ objective: next })}
        />
      </Block>

      <Block
        region="key-results"
        title={gc.keyResultsTitle}
        hint={gc.keyResultsHint}
        action={<span className="text-sm text-muted-foreground">{gc.countOfThree(keyResults.length)}</span>}
      >
        <div className="flex flex-col gap-3">
          {keyResults.length === 0 ? <p className="text-sm text-muted-foreground">{gc.keyResultsEmpty}</p> : null}
          {keyResults.map((kr) => (
            <KeyResultCard
              key={kr.id}
              kr={kr}
              onEdit={() => setKrDialog({ open: true, existing: kr })}
              onRemove={() => removeKeyResult(kr.id)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="self-start border-dashed"
            onClick={() => setKrDialog({ open: true, existing: undefined })}
           aria-label={gc.addKeyResult}>
            <Plus />
            {plusNoun(gc.addKeyResult)}
          </Button>
        </div>
      </Block>

      <Separator />

      {/* A KPI is named by the project as a whole, with the reason it is
          named (Programme Lead, 2026-09-26). It used to hang off one key
          result, which said something untrue: one KPI is moved by several
          projects, and nothing here claims a KPI can judge this project. */}
      <Block
        region="kpis"
        title={gc.kpiTitle}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setAddKpi(true)} aria-label={gc.addKpi}>
            <Plus />
            {plusNoun(gc.addKpi)}
          </Button>
        }
      >
        <Suggested
          kind="KPI"
          selected={namedKpis.map((k) => k.kpi)}
          onPick={(id) => {
            if (namedKpis.some((k) => k.kpi === id)) return;
            setSuggestedKpi(id);
            setAddKpi(true);
          }}
        />
        {namedKpis.length === 0 ? (
          <p className="text-sm text-muted-foreground">{gc.kpiNoneYet}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {namedKpis.map((k, i) => (
              <div key={`${k.kpi}-${i}`} data-cartograph-region={`kpi-${i}`} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{kpiNames.get(k.kpi) ?? k.kpi}</span>
                  <span className="text-xs text-muted-foreground text-pretty">{k.reason}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => removeKpi(i)}
                  aria-label={copy.projects.common.remove}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Block>

      <KeyResultDialog
        data-cartograph-field={`/spec/objectives/${seg(store.spec.objectives?.[0], 0)}/keyResults/${
          krDialog.existing ? `{${krDialog.existing.id}}` : "-"
        }`}
        open={krDialog.open}
        existing={krDialog.existing}
        onOpenChange={(open) => setKrDialog((prev) => ({ ...prev, open }))}
        onSave={saveKeyResult}
      />

      <AddKpiDialog
        key={suggestedKpi ?? "-"}
        initialKpi={suggestedKpi}
        open={addKpi}
        taken={namedKpis.map((k) => k.kpi)}
        onOpenChange={(open) => {
          setAddKpi(open);
          if (!open) setSuggestedKpi(undefined);
        }}
        onSave={(kpi, reason) =>
          store.updateSpec((sp) => ({ ...sp, kpis: [...(sp.kpis ?? []), { kpi, reason }] }))
        }
      />
    </div>
  );
}

/**
 * Name a KPI this project moves, and say why. Nothing is asked about a key
 * result: the KPI's own direction belongs to the KPI, and one KPI may be
 * moved by several projects (Programme Lead, 2026-09-26).
 */
function AddKpiDialog({
  open,
  initialKpi,
  taken,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  /** A suggested KPI to start from; the reason is still asked. */
  initialKpi?: string;
  /** Already named by this project, so it is not offered twice. */
  taken: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (kpi: string, reason: string) => void;
}) {
  const [kpi, setKpi] = useState<string | undefined>(initialKpi);
  const [reason, setReason] = useState("");
  // As everywhere else: Add stays live and a refused one marks the field
  // it is waiting on, rather than going dead and silent.
  const [refused, setRefused] = useState(false);

  const canSave = !!kpi && reason.trim() !== "" && !taken.includes(kpi);

  function close(next: boolean) {
    if (!next) {
      setKpi(undefined);
      setReason("");
      setRefused(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" data-cartograph-region="dialog-add-kpi">
        <DialogHeader>
          <DialogTitle>{gc.addKpi}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{gc.kpiLabel}</Label>
            <ReferencePicker
              data-cartograph-field="/spec/kpis/-/kpi"
              refKind="KPI"
              value={kpi}
              onChange={(v) => setKpi(v ?? undefined)}
              placeholder={gc.kpiPlaceholder}
            />
            {refused && !kpi ? <p className="text-xs text-destructive">{gc.kpiPlaceholder}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{gc.kpiReasonLabel}</Label>
            <Input
              data-cartograph-field="/spec/kpis/-/reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 160))}
              aria-label={gc.kpiReasonLabel}
              aria-invalid={refused && reason.trim() === ""}
              maxLength={160}
            />
            <p className="self-end text-xs text-muted-foreground">{160 - reason.length}</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {copy.projects.common.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!canSave) {
                setRefused(true);
                return;
              }
              onSave(kpi as string, reason.trim());
              close(false);
            }}
          >
            {copy.projects.common.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
