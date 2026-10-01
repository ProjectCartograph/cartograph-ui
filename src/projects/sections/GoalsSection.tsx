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
import { client } from "@/api/client";
import { copy } from "@/copy";
import { useGoalTree } from "@/surfaces/goals/api";
import { ObjectiveEditor } from "../ObjectiveEditor";
import { KeyResultCard } from "@/surfaces/goals/KeyResultCard";
import { KeyResultDialog } from "@/surfaces/goals/KeyResultDialog";
import type { KeyResult } from "@/surfaces/goals/types";
import { DirectorySelect } from "@/surfaces/sheet/DirectorySelect";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { useSectionAutosave, useProjectStore } from "../store";

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
  return useQuery({
    queryKey: ["programme-goals"],
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}", {
        params: { path: { kind: "Programme" } },
      });
      if (error) throw error;
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      const out = new Map<string, string[]>();
      await Promise.all(
        items.map(async (summary) => {
          const res = await client.GET("/manifests/{kind}/{id}", {
            params: { path: { kind: "Programme", id: summary.id } },
          });
          const spec = (res.data as unknown as { manifest?: { spec?: { goals?: string[] } } })?.manifest?.spec;
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
  return useQuery({
    queryKey: ["project-aim-kpis"],
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}", { params: { path: { kind: "KPI" } } });
      if (error) throw error;
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      return items as KPIRow[];
    },
  });
}

/** A block of the step, with its own heading and, only where a rule needs
 * saying, one short line under it. */
function Block({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
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

  // Which goals the chosen programmes already serve. A project proves it
  // belongs to a programme by sharing a goal with it, so those goals are
  // offered first and the rest are marked as reaching outside them
  // (Programme Lead, 2026-09-27).
  const withinProgrammes = useMemo(() => {
    const out = new Set<string>();
    for (const id of programmes) for (const g of programmeGoals?.get(id) ?? []) out.add(g);
    return out;
  }, [programmes, programmeGoals]);

  // Each programme this project names must have one of its own goals
  // picked; until it does, the claim is unproven.
  const unproven = useMemo(
    () =>
      programmes.filter((id) => !(programmeGoals?.get(id) ?? []).some((g) => goals.includes(g))),
    [programmes, programmeGoals, goals],
  );


  // Every functional goal in the tree, in tree order, each carrying the
  // branch it sits on: the pillar groups, the strategic area subgroups.
  const chips = useMemo<ChipItem[]>(() => {
    const out: ChipItem[] = [];
    for (const pillar of treeQuery.data?.nodes ?? []) {
      for (const strategic of pillar.children ?? []) {
        for (const functional of strategic.children ?? []) {
          if (functional.level !== "outcome") continue;
          out.push({
            id: functional.id,
            label: functional.name,
            group: pillar.name,
            tag: strategic.name,
            title: `${pillar.name} / ${strategic.name}`,
          });
        }
      }
    }
    return out;
  }, [treeQuery.data]);

  // Split, not filtered: a project may serve a goal none of its
  // programmes serve, so the rest stay pickable under their own heading
  // rather than disappearing.
  const within = useMemo(() => chips.filter((c) => withinProgrammes.has(c.id)), [chips, withinProgrammes]);
  const beyond = useMemo(() => chips.filter((c) => !withinProgrammes.has(c.id)), [chips, withinProgrammes]);

  function toggleGoal(goalId: string) {
    store.updateSpec((s) => {
      const current = s.alignment?.goals ?? [];
      const next = current.includes(goalId) ? current.filter((g) => g !== goalId) : [...current, goalId];
      return { ...s, alignment: { ...s.alignment, goals: next } };
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* What this is part of comes first: a programme carries goals with
          it, so naming one turns the whole tree into a short list. */}
      <div className="flex flex-col gap-3">
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
      </div>
      )}

      {partOf === "project" && parent ? null : <Separator />}

      {partOf === "project" && parent ? null : treeQuery.isLoading ? <p className="text-sm text-muted-foreground">{copy.goals.home.loading}</p> : null}
      {treeQuery.isError ? <p className="text-sm text-destructive">{copy.goals.home.error}</p> : null}
      {treeQuery.data && !(partOf === "project" && parent) ? (
        <div className="flex flex-col gap-6">
          {programmes.length > 0 ? (
            <div className="flex flex-col gap-3">
              <FieldHeading label={gc.withinLabel} hint={gc.withinHint} />
              <ChipPicker
                slot="goal-chips"
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
      <Block title={gc.objectiveTitle}>
        <ObjectiveEditor
          objective={objective.objective}
          alignedGoals={goals.length}
          onChange={(next) => updateObjective({ objective: next })}
        />
      </Block>

      <Block
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
          >
            <Plus />
            {gc.addKeyResult}
          </Button>
        </div>
      </Block>

      <Separator />

      {/* A KPI is named by the project as a whole, with the reason it is
          named (Programme Lead, 2026-09-26). It used to hang off one key
          result, which said something untrue: one KPI is moved by several
          projects, and nothing here claims a KPI can judge this project. */}
      <Block
        title={gc.kpiTitle}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setAddKpi(true)}>
            <Plus />
            {gc.addKpi}
          </Button>
        }
      >
        {namedKpis.length === 0 ? (
          <p className="text-sm text-muted-foreground">{gc.kpiNoneYet}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {namedKpis.map((k, i) => (
              <div key={`${k.kpi}-${i}`} className="flex items-start justify-between gap-3 rounded-lg border p-3">
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
        open={krDialog.open}
        existing={krDialog.existing}
        onOpenChange={(open) => setKrDialog((prev) => ({ ...prev, open }))}
        onSave={saveKeyResult}
      />

      <AddKpiDialog
        open={addKpi}
        taken={namedKpis.map((k) => k.kpi)}
        onOpenChange={setAddKpi}
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
  taken,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  /** Already named by this project, so it is not offered twice. */
  taken: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (kpi: string, reason: string) => void;
}) {
  const [kpi, setKpi] = useState<string | undefined>(undefined);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{gc.addKpi}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{gc.kpiLabel}</Label>
            <ReferencePicker
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
