import { useMemo, useState } from "react";
import { Boxes, FolderKanban, Plus, TriangleAlert, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { ChipPicker, type ChipItem } from "@/components/ChipPicker";
import { FieldHeading, Help } from "@/components/guidance";
import { VocabMark } from "@/components/vocab";
import { useClient } from "@/client/context";
import { orUndefined } from "@/client/port";
import { copy, plusNoun } from "@/copy";
import { useGoalTree } from "@/surfaces/goals/api";
import { useGuide, vocabulary } from "@/components/guide";

import { ObjectiveEditor } from "../ObjectiveEditor";
import { KeyResultCard } from "@/surfaces/goals/KeyResultCard";
import { KeyResultDialog } from "@/surfaces/goals/KeyResultDialog";
import type { KeyResult } from "@/surfaces/goals/types";
import { DirectorySelect } from "@/surfaces/sheet/DirectorySelect";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { Suggested } from "@/components/relevance";
import { Textarea } from "@/components/ui/textarea";
import { useSectionAutosave, useProjectStore } from "../store";
import { seg } from "../field";

const gc = copy.projects.goals;

// The stock toggle's "on" state is a muted fill, which reads as a hover
// rather than a choice (the success dialog uses the same).
const PICKED = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary";

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

  const { data: projectOptions } = useReferenceOptions("Project");
  const goals = store.spec.alignment?.goals ?? [];
  const programmes = store.spec.alignment?.programmes ?? [];
  const parent = store.spec.alignment?.partOf;
  // Which question is being answered: part of programmes, or a component of
  // one bigger project. Held here so the second can be chosen before a
  // project is picked.
  const [partOf, setPartOf] = useState<"programmes" | "project">(parent ? "project" : "programmes");
  const parentName = parent ? (projectOptions?.names.get(parent) ?? parent) : "";

  function choosePartOf(next: string) {
    if (next !== "programmes" && next !== "project") return;
    setPartOf(next);
    if (next === "programmes") {
      store.updateSpec((s) => ({ ...s, alignment: { ...s.alignment, partOf: undefined } }));
    }
  }

  function chooseParent(id: string | undefined) {
    // A component belongs to its parent's programmes (TAXONOMY.md D15), so
    // naming its own would be a second place to change one fact.
    store.updateSpec((s) => ({
      ...s,
      alignment: { ...s.alignment, partOf: id, programmes: id ? undefined : s.alignment?.programmes },
    }));
  }

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
      {/* Asked first: everything suggested from here on is ranked against
          it (engine docs/adr/0023). */}
      <div className="flex flex-col gap-2" data-cartograph-region="about">
        <FieldHeading label={copy.projects.align.aboutLabel} hint={copy.projects.align.aboutHint} htmlFor="project-about" />
        <Textarea
          id="project-about"
          data-cartograph-field="/spec/summary/about"
          value={store.spec.summary.about ?? ""}
          onChange={(e) => store.updateSpec((s) => ({ ...s, summary: { ...s.summary, about: e.target.value.slice(0, 300) || undefined } }))}
          rows={2}
          className="sm:max-w-xl"
        />
      </div>
      {/* What this is part of comes first: a programme carries goals with
          it, so naming one turns the whole tree into a short list. */}
      <div className="flex flex-col gap-3" data-cartograph-region="part-of">
        <FieldHeading label={gc.programmesLabel} />
        <ToggleGroup
          type="single"
          variant="outline"
          value={partOf}
          onValueChange={choosePartOf}
          aria-label={gc.programmesLabel}
          data-slot="part-of"
        >
          <ToggleGroupItem value="programmes" className={PICKED}>
            <FolderKanban aria-hidden="true" />
            {gc.partOfProgrammes}
          </ToggleGroupItem>
          <ToggleGroupItem value="project" className={PICKED}>
            <Boxes aria-hidden="true" />
            {gc.partOfProject}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {partOf === "project" ? (
        <div className="flex flex-col gap-2 sm:max-w-xl" data-slot="parent-project">
          <FieldHeading label={gc.parentLabel} hint={gc.parentHint} />
          <ReferencePicker
            data-cartograph-field="/spec/alignment/partOf"
            refKind="Project"
            value={parent}
            onChange={chooseParent}
            placeholder={gc.parentPlaceholder}
            label={gc.parentLabel}
          />
          {parent ? <p className="text-sm text-muted-foreground">{gc.inheritsGoals(parentName)}</p> : null}
        </div>
      ) : (
      <div className="flex flex-col gap-2">
        <Suggested
          kind="Programme"
          selected={programmes}
          onPick={(id) =>
            store.updateSpec((s) => {
              const cur = s.alignment?.programmes ?? [];
              return { ...s, alignment: { ...s.alignment, programmes: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } };
            })
          }
        />
        <ComboboxMultiple
          options={programmeOptions?.options ?? []}
          value={programmes}
          onValueChange={(next) =>
            store.updateSpec((s) => ({ ...s, alignment: { ...s.alignment, programmes: next } }))
          }
          placeholder={gc.programmesPlaceholder}
          emptyText={copy.sheets.dialog.noMatches}
          removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
          aria-label={gc.programmesLabel}
          data-cartograph-field="/spec/alignment/programmes"
          className="sm:max-w-xl"
        />
        {unproven.length > 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-slot="unproven-programmes">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            {gc.unprovenProgramme(
              unproven.map((id) => programmeOptions?.names.get(id) ?? id).join(", "),
            )}
          </p>
        ) : null}
        <div className="mt-2 flex flex-col gap-2" data-slot="portfolios">
          <FieldHeading label={gc.portfoliosLabel} hint={gc.portfoliosHint} />
          <Suggested
            kind="Portfolio"
            selected={store.spec.alignment?.portfolios ?? []}
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
            value={store.spec.alignment?.portfolios ?? []}
            onValueChange={(next) =>
              store.updateSpec((s) => ({ ...s, alignment: { ...s.alignment, portfolios: next.length > 0 ? next : undefined } }))
            }
            emptyText={copy.sheets.dialog.noMatches}
            removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
            aria-label={gc.portfoliosLabel}
            data-cartograph-field="/spec/alignment/portfolios"
            className="sm:max-w-xl"
          />
        </div>
      </div>
      )}

      {partOf === "project" && parent ? null : <Separator />}

      {partOf === "project" && parent ? null : treeQuery.isLoading ? <p className="text-sm text-muted-foreground">{copy.goals.home.loading}</p> : null}
      {treeQuery.isError ? <p className="text-sm text-destructive">{copy.goals.home.error}</p> : null}
      {treeQuery.data && !(partOf === "project" && parent) ? (
        <div className="flex flex-col gap-6" data-cartograph-region="goal-picker">
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

  // The words the engine's guide offers for writing the objective.
  const guide = useGuide("Project");
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
          verbs={vocabulary(guide.data, "objectiveVerbs")}
          meansWord={vocabulary(guide.data, "meansWord")[0] ?? ""}
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
