import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, CheckCircle2, ClipboardCheck, CornerDownRight, Gauge, MessageSquare, Plus, Target, UserRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FieldHeading, Help } from "@/components/guidance";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useClient } from "@/client/context";
import { ConflictNotes } from "@/collab/ConflictNotes";
import { OfflineNote } from "@/collab/OfflineNote";
import { useDraftState, useSharedManifest } from "@/collab/draft";
import { copy, plusNoun } from "@/copy";
import { ErrorAlert } from "@/components/error-alert";
import { DirectorySelect } from "@/surfaces/sheet/DirectorySelect";
import { ShowInGraph } from "@/graph/ShowInGraph";
import { useGoalChecks, useGoalManifest, useGoalReferences, useGoalTree, useSettings } from "./api";
import { InlineTitle } from "./InlineTitle";
import { KeyResultCard } from "./KeyResultCard";
import { KeyResultDialog } from "./KeyResultDialog";
import { SmartMarks } from "./SmartMarks";
import { fieldGuide, useGuide } from "@/components/guide";

import { AimEditor } from "./AimEditor";
import { HorizonPicker } from "./HorizonPicker";
import { GoalReview, GoalSteps, StepNav, type GoalStep } from "./GoalSteps";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useManifestName } from "@/api/names";
import { renameGoal, saveGoalFields } from "./mutations";
import type { GoalNode } from "./tree-types";
import type { GoalLink, GoalManifest, KeyResult } from "./types";
import { defaultGoalLevels } from "./tree-types";

const ec = copy.goals.editor;

function flattenPillars(nodes: GoalNode[]): GoalNode[] {
  return nodes.filter((n) => n.level === "goal");
}

function flattenStrategic(nodes: GoalNode[]): GoalNode[] {
  const result: GoalNode[] = [];
  for (const pillar of nodes.filter((n) => n.level === "goal")) {
    result.push(...(pillar.children ?? []));
  }
  return result;
}

// Maps a 422 problem's JSON Pointer path onto the hand-laid-out field it
// belongs to, the same idea SheetForm.tsx's generated form uses for its own
// fieldForPath, just against this editor's fixed set of fields instead of a
// schema-derived list. A path with no match here stays in the top banner.
function fieldForPath(path: string): string | null {
  const direct: Record<string, string> = {
    "/spec/objective": "objective",
    "/spec/whyItMatters": "whyItMatters",
    "/spec/parent": "parent",
    "/spec/evidence": "evidence",
  };
  if (direct[path]) return direct[path];
  if (path === "/spec/keyResults" || path.startsWith("/spec/keyResults/")) return "keyResults";
  return null;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function GoalEditor({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const client = useClient();
  const manifestQuery = useGoalManifest(id);
  const checksQuery = useGoalChecks(id);
  const referencesQuery = useGoalReferences(id);
  const treeQuery = useGoalTree();
  const settingsQuery = useSettings();

  const manifest = manifestQuery.data?.manifest as GoalManifest | undefined;
  const version = manifestQuery.data?.version.number;

  // The fields live in the goal's shared draft while it is open, so the
  // people on this goal see each other's edits as they make them; with no
  // draft they are this screen's own, loaded from the version as before.
  const shared = useSharedManifest(client, "Goal", id);
  const [objective, setObjective] = useDraftState(shared, "/spec/objective", "");
  const [whyItMatters, setWhyItMatters] = useDraftState(shared, "/spec/whyItMatters", "");
  const [parent, setParent] = useDraftState<string>(shared, "/spec/parent", "");
  const [evidence, setEvidence] = useDraftState(shared, "/spec/evidence", "");
  const [keyResults, setKeyResults] = useDraftState<KeyResult[]>(shared, "/spec/keyResults", []);
  const [links, setLinks] = useDraftState<GoalLink[]>(shared, "/spec/contributesTo", []);
  const [owner, setOwner] = useDraftState<string | undefined>(shared, "/spec/owner", undefined);
  const [horizonStart, setHorizonStart] = useDraftState(shared, "/spec/horizon/start", "");
  const [horizonEnd, setHorizonEnd] = useDraftState(shared, "/spec/horizon/end", "");
  const [loadedVersion, setLoadedVersion] = useState<number | undefined>(undefined);
  const sharing = shared.draft !== undefined;

  useEffect(() => {
    // The draft already holds every field; seeding it from the version
    // would write over what the others are typing.
    if (sharing) return;
    if (manifest && version !== loadedVersion) {
      setObjective(manifest.spec.objective ?? "");
      setWhyItMatters(manifest.spec.whyItMatters ?? "");
      setParent(manifest.spec.parent ?? "");
      setEvidence(manifest.spec.evidence ?? "");
      setKeyResults(manifest.spec.keyResults ?? []);
      setLinks(manifest.spec.contributesTo ?? []);
      setOwner(manifest.spec.owner);
      setHorizonStart(manifest.spec.horizon?.start ?? "");
      setHorizonEnd(manifest.spec.horizon?.end ?? "");
      setLoadedVersion(version);
    }
    // The setters are stable for a given draft, and there is none here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, version, loadedVersion, sharing]);

  const [krDialog, setKrDialog] = useState<{ open: boolean; existing?: KeyResult }>({ open: false });
  const [saveOpen, setSaveOpen] = useState(false);
  const [yamlOpen, setYamlOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassed, setShowPassed] = useState(false);
  const [step, setStep] = useState("aim");

  const level = manifest?.spec.level ?? "goal";
  // The engine's guide for this level: what the statement must say, with
  // right and wrong examples, and the opening words offered for an aim.
  const guide = useGuide("Goal", level);
  const statementGuide = fieldGuide(guide.data, "/spec/objective");

  const pillarOptions = useMemo(
    () => flattenPillars(treeQuery.data?.nodes ?? []).filter((n) => n.id !== id),
    [treeQuery.data, id]
  );
  const strategicOptions = useMemo(
    () => flattenStrategic(treeQuery.data?.nodes ?? []).filter((n) => n.id !== id),
    [treeQuery.data, id]
  );
  const parentRefOptions = useMemo(() => {
    const options = level === "objective"
      ? pillarOptions.map((n) => ({ value: n.id, label: n.name }))
      : strategicOptions.map((n) => ({ value: n.id, label: n.name }));
    return options;
  }, [pillarOptions, strategicOptions, level]);
  // An outcome already leads to its parent; the others it serves are
  // picked from the objectives and goals above it (D24).
  const linkOptions = useMemo(
    () => [...strategicOptions, ...pillarOptions]
      .filter((n) => n.id !== parent)
      .map((n) => ({ value: n.id, label: n.name })),
    [strategicOptions, pillarOptions, parent]
  );

  if (manifestQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-4 xl:col-span-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }
  if (manifestQuery.isError || !manifest) {
    return <ErrorAlert message={ec.error} onRetry={() => manifestQuery.refetch()} />;
  }

  const levels = settingsQuery.data?.goalLevels ?? defaultGoalLevels();
  const levelLabel = level === "goal" ? (levels[0] ?? level) : level === "objective" ? (levels[1] ?? level) : (levels[2] ?? level);

  // A check's fix names a section; open the step that holds it first, then
  // bring the field into view once it has rendered.
  const SECTION_STEP: Record<string, string> = {
    parent: "aim", objective: "aim", title: "aim",
    keyResults: "measures", evidence: "measures",
    owner: "timing", horizon: "timing",
    whyItMatters: "why", contributesTo: "links",
  };
  function scrollTo(section: string) {
    setStep(SECTION_STEP[section] ?? "aim");
    setTimeout(() => document.getElementById(`goal-section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function handleRename(next: string) {
    if (!manifest) return;
    const result = await renameGoal(client, id, next);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-manifest", id] });
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    }
  }

  async function handleMoveTo(newParentId: string) {
    setParent(newParentId);
    if (!manifest) return;
    const result = await saveGoalFields(client, id, manifest.metadata.name, {
      level, parent: newParentId, objective, whyItMatters, evidence, keyResults,
    }, "edited on the tree");
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-manifest", id] });
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
      queryClient.invalidateQueries({ queryKey: ["goal-checks", id] });
    }
  }

  async function handleSave() {
    if (!manifest) return;
    // A horizon is both ends, each a year or a year and month, or none at
    // all. Half of one used to be dropped without a word on save.
    if ((horizonStart || horizonEnd) && !(PERIOD.test(horizonStart) && PERIOD.test(horizonEnd))) {
      setFieldErrors({ horizon: ec.horizon.incomplete });
      setSaveOpen(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    setConflict(false);
    const result = await saveGoalFields(client, id, manifest.metadata.name, {
      level,
      ...(parent ? { parent } : {}),
      objective, whyItMatters, evidence, keyResults,
      statedAs: manifest.spec.statedAs,
      source: manifest.spec.source,
      contributesTo: links,
      owner,
      ...(horizonStart && horizonEnd ? { horizon: { start: horizonStart, end: horizonEnd } } : {}),
    }, reason);
    setSaving(false);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-manifest", id] });
      queryClient.invalidateQueries({ queryKey: ["goal-checks", id] });
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
      queryClient.invalidateQueries({ queryKey: ["goal-references", id] });
      setSaveOpen(false);
      setReason("");
      return;
    }
    if (result.conflict) {
      setConflict(true);
      return;
    }
    const nextFieldErrors: Record<string, string> = {};
    const unmatched: string[] = [];
    for (const p of result.problems) {
      const field = fieldForPath(p.path);
      if (field) nextFieldErrors[field] = p.message;
      else unmatched.push(p.message);
    }
    setFieldErrors(nextFieldErrors);
    setSaveError(unmatched.length > 0 ? unmatched.join(" ") : result.problems.length === 0 ? ec.save.generalError : null);
  }

  const checks = checksQuery.data ?? [];
  // Plain, not a memo: this runs after the loading returns above.
  const findNode = (ns: GoalNode[]): GoalNode | undefined => {
    for (const n of ns) {
      if (n.id === id) return n;
      const hit = findNode(n.children ?? []);
      if (hit) return hit;
    }
    return undefined;
  };
  const node = findNode(treeQuery.data?.nodes ?? []);
  const smart = node?.smart;
  const toFixCount = checks.filter((c) => c.state === "warn").length;

  // Aligned to this goal mirrors the tree's aligned counts: Project,
  // Programme, Operation and KPI.
  const ALIGN_KINDS = ["Project", "Programme", "Operation", "KPI"];
  const groupedAligned = new Map<string, { id: string; name: string }[]>();
  for (const s of referencesQuery.data?.incoming ?? []) {
    if (!ALIGN_KINDS.includes(s.kind)) continue;
    const list = groupedAligned.get(s.kind) ?? [];
    list.push({ id: s.id, name: s.name });
    groupedAligned.set(s.kind, list);
  }
  const alignedKPIs = groupedAligned.get("KPI") ?? [];
  const stc = ec.steps;
  const steps: GoalStep[] = [
    { key: "aim", label: stc.aim, icon: Target, done: objective.trim() !== "" },
    // Done as the engine says Measurable is met: a measure with a target,
    // not only a measure (TAXONOMY.md D25).
    { key: "measures", label: stc.measures, icon: Gauge, done: smart?.measurable === true },
    { key: "timing", label: stc.timing, icon: CalendarRange, done: !!owner && (!!(horizonStart && horizonEnd) || !!node?.horizon) },
    { key: "why", label: stc.why, icon: MessageSquare, done: whyItMatters.trim() !== "" },
    ...(level === "outcome" ? [{ key: "links", label: stc.links, icon: CornerDownRight, done: links.length > 0, optional: true }] : []),
    { key: "review", label: stc.review, icon: ClipboardCheck, done: false },
  ];
  const alignedFlat = Array.from(groupedAligned.entries()).flatMap(([kind, items]) =>
    items.map((it) => ({ kind, ...it }))
  );

  return (
    <div className="flex flex-col gap-6" data-cartograph-region="goal-editor">
      <div className="flex items-start justify-between gap-4">
        <div id="goal-section-title" className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <InlineTitle
              data-cartograph-field="/metadata/name"
              value={manifest.metadata.name}
              onSave={handleRename}
              as="h1"
              className="min-w-0 text-2xl font-semibold tracking-tight"
            />
            <Badge variant="secondary" className="shrink-0">
              {levelLabel}
            </Badge>
            <SmartMarks smart={smart} />
            {version ? <span className="shrink-0 text-sm text-muted-foreground">{ec.version(version)}</span> : null}
            <ShowInGraph kind="Goal" id={id} />
          </div>
          <AimContext horizon={node?.horizon} owner={node?.owner} />
          {version !== undefined && version > 0 ? (
            <p className="text-xs text-muted-foreground">{ec.levelKept}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OfflineNote />
          <Button type="button" variant="outline" onClick={() => setYamlOpen(true)}>
            {ec.viewAsYaml}
          </Button>
          <Button type="button" onClick={() => setSaveOpen(true)}>
            {ec.save.button}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <GoalSteps steps={steps} current={step} onPick={setStep} />
          <ConflictNotes conflicts={shared.conflicts} onResolve={shared.resolve} />

          {step === "aim" ? (
            <>
              {level === "objective" || level === "outcome" ? (
                <div id="goal-section-parent" className="flex flex-col gap-2">
                  <Label>{ec.moveTo.label}</Label>
                  <div className="rounded-lg border border-dashed p-3">
                    <DirectorySelect
                      data-cartograph-field="/spec/parent"
                      kind="Goal"
                      value={parent}
                      onValueChange={handleMoveTo}
                      options={parentRefOptions}
                      placeholder={ec.moveTo.placeholder}
                    />
                  </div>
                  <FieldError message={fieldErrors.parent} />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Label>{ec.moveTo.label}</Label>
                  <Help label={ec.moveTo.label} hint={ec.moveTo.pillarHint} />
                </div>
              )}


              <div id="goal-section-objective" className="flex flex-col gap-2">
                <FieldHeading
                  label={ec.statementLabel[level] ?? ec.objective.label}
                  hint={statementGuide?.guide ?? ec.objectiveHint[level] ?? ec.objective.hint}
                  examples={statementGuide?.good}
                  poor={statementGuide?.poor}
                  htmlFor="goal-objective"
                />
                <AimEditor
                  data-cartograph-field="/spec/objective"
                  level={level}
                  value={objective}
                  onChange={(v) => setObjective(v.slice(0, ec.objective.maxLength))}
                  maxLength={ec.objective.maxLength}
                />
                <FieldError message={fieldErrors.objective} />
              </div>
            </>
          ) : null}

          {step === "measures" ? (
          <section id="goal-section-measures" data-cartograph-region="measures" aria-label={ec.measures.label} className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-1">
              <h2 className="text-sm font-semibold">{ec.measures.label}</h2>
              <Help label={ec.measures.label} hint={ec.measures.hint} />
            </div>
            <div id="goal-section-keyResults" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Label>{ec.keyResults.label}</Label>
                  <Help label={ec.keyResults.label} hint={ec.keyResults.hint} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {ec.keyResults.countOfThree(keyResults.length)}
                </span>
              </div>
              <FieldError message={fieldErrors.keyResults} />
              <div className="flex flex-col gap-2" data-cartograph-region="key-results">
                {keyResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{ec.keyResults.empty}</p>
                ) : null}
                {keyResults.map((kr) => (
                  <KeyResultCard
                    key={kr.id}
                    kr={kr}
                    onEdit={() => setKrDialog({ open: true, existing: kr })}
                    onRemove={() => setKeyResults((prev) => prev.filter((x) => x.id !== kr.id))}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="self-start border-dashed"
                  onClick={() => setKrDialog({ open: true, existing: undefined })}
                 aria-label={ec.keyResults.add}>
                  <Plus />
                  {plusNoun(ec.keyResults.add)}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{ec.measures.indicators}</Label>
              {alignedKPIs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{ec.measures.noIndicators}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {alignedKPIs.map((k) => (
                    <li key={k.id} className="flex items-center gap-2 text-sm">
                      <Gauge className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {k.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {evidence ? (
              <div id="goal-section-evidence" className="flex flex-col gap-2">
                <FieldHeading label={ec.scoredOn.label} htmlFor="goal-scored-on" />
                <Input
                  id="goal-scored-on"
                  data-cartograph-field="/spec/evidence"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value.slice(0, ec.scoredOn.maxLength))}
                  placeholder={ec.scoredOn.placeholder}
                  maxLength={ec.scoredOn.maxLength}
                />
                <FieldError message={fieldErrors.evidence} />
              </div>
            ) : null}
          </section>

          ) : null}

          {step === "timing" ? (
            <div className="flex flex-col gap-6">
              <div id="goal-section-owner" className="flex flex-col gap-2">
                <FieldHeading label={ec.owner.label} hint={ec.owner.hint} />
                <ReferencePicker data-cartograph-field="/spec/owner" refKind="Resource" value={owner} onChange={setOwner} label={ec.owner.label} />
              </div>
              <div id="goal-section-horizon" className="flex flex-col gap-2">
                <FieldHeading label={ec.horizon.label} hint={ec.horizon.hint[level] ?? ""} />
                <HorizonPicker
                  data-cartograph-field="/spec/horizon"
                  start={horizonStart}
                  end={horizonEnd}
                  onChange={(s, e) => { setHorizonStart(s); setHorizonEnd(e); }}
                  canInherit={level !== "goal"}
                  inheritedSpan={node?.horizon?.inherited ? span(node.horizon) : undefined}
                />
                <FieldError message={fieldErrors.horizon} />
              </div>
            </div>
          ) : null}

          {step === "why" ? (
            <div id="goal-section-whyItMatters" className="flex flex-col gap-2">
              <FieldHeading label={ec.whyItMatters.label} hint={ec.whyItMatters.hint} htmlFor="goal-why" />
              <Input
                id="goal-why"
                data-cartograph-field="/spec/whyItMatters"
                value={whyItMatters}
                onChange={(e) => setWhyItMatters(e.target.value.slice(0, ec.whyItMatters.maxLength))}
                maxLength={ec.whyItMatters.maxLength}
                className="text-base"
              />
              <FieldError message={fieldErrors.whyItMatters} />
            </div>
          ) : null}

          {level === "outcome" && step === "links" ? (
            <div id="goal-section-contributes" className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <Label>{ec.contributesTo.label}</Label>
                <Help label={ec.contributesTo.label} hint={ec.contributesTo.hint} />
              </div>
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <DirectorySelect
                    data-cartograph-field={`/spec/contributesTo/${i}/goal`}
                    kind="Goal"
                    value={link.goal}
                    onValueChange={(v) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, goal: v } : l)))}
                    options={linkOptions}
                    loading={treeQuery.isLoading}
                    placeholder={ec.contributesTo.choose}
                    className="w-64 shrink-0"
                  />
                  <Input
                    data-cartograph-field={`/spec/contributesTo/${i}/because`}
                    aria-label={ec.contributesTo.because}
                    placeholder={ec.contributesTo.because}
                    value={link.because ?? ""}
                    onChange={(e) => setLinks((ls) => ls.map((l, j) => (j === i ? { ...l, because: e.target.value } : l)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={ec.contributesTo.remove}
                    onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setLinks((ls) => [...ls, { goal: "" }])}
               aria-label={ec.contributesTo.add}>
                <Plus />
                {plusNoun(ec.contributesTo.add)}
              </Button>
            </div>
          ) : null}

          {step === "review" ? (
            <GoalReview
              level={level}
              levelLabel={levelLabel}
              objective={objective}
              keyResults={keyResults.length}
              indicators={alignedKPIs.length}
              horizon={horizonStart && horizonEnd ? span({ start: horizonStart, end: horizonEnd }) : node?.horizon ? span(node.horizon) : ""}
              ownerId={owner}
              why={whyItMatters}
              smart={smart}
              onEdit={setStep}
              onSave={() => setSaveOpen(true)}
            />
          ) : null}

          <StepNav steps={steps} current={step} onPick={setStep} />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-lg border p-4" data-cartograph-region="checks">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{ec.checks.title}</h2>
              {toFixCount > 0 ? <Badge variant="secondary">{ec.checks.toFix(toFixCount)}</Badge> : null}
            </div>
            {checksQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {checks.filter((c) => showPassed || c.state !== "ok").map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    {c.state === "ok" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1">
                      {c.message}
                      {c.state === "warn" && c.fix ? (
                        <Button
                          type="button"
                          variant="link"
                          className="ml-1 h-auto p-0 text-sm"
                          onClick={() => scrollTo(c.fix!.section)}
                        >
                          {ec.checks.fix}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {checks.some((c) => c.state === "ok") ? (
              <Button type="button" variant="link" className="h-auto self-start p-0 text-xs text-muted-foreground" onClick={() => setShowPassed((v) => !v)}>
                {showPassed ? ec.checks.hidePassed : ec.checks.showPassed(checks.filter((c) => c.state === "ok").length)}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-4" data-cartograph-region="aligned">
            <h2 className="text-sm font-semibold">{ec.aligned.title}</h2>
            {referencesQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : alignedFlat.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ec.aligned.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {alignedFlat.slice(0, 3).map((a) => (
                  <li key={`${a.kind}-${a.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate">{a.name}</span>
                      </TooltipTrigger>
                      <TooltipContent>{a.name}</TooltipContent>
                    </Tooltip>
                    <Badge variant="secondary" className="shrink-0">
                      {a.kind}
                    </Badge>
                  </li>
                ))}
                {alignedFlat.length > 3 ? (
                  <li className="text-sm text-muted-foreground">{ec.aligned.moreLink(alignedFlat.length - 3)}</li>
                ) : null}
              </ul>
            )}
          </div>
        </div>
      </div>

      <KeyResultDialog
        data-cartograph-field={krDialog.existing ? `/spec/keyResults/{${krDialog.existing.id}}` : "/spec/keyResults/-"}
        open={krDialog.open}
        existing={krDialog.existing}
        allowSource={false}
        onOpenChange={(open) => setKrDialog((prev) => ({ ...prev, open }))}
        onSave={(kr) =>
          setKeyResults((prev) => {
            const idx = prev.findIndex((x) => x.id === kr.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = kr;
              return next;
            }
            return [...prev, kr];
          })
        }
      />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md" data-cartograph-region="dialog-save">
          <DialogHeader>
            <DialogTitle>{ec.save.dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {conflict ? <p className="text-sm text-destructive">{ec.save.conflict}</p> : null}
            {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="goal-save-reason">{ec.save.reasonLabel}</Label>
              <Input
                id="goal-save-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 60))}
                placeholder={ec.save.reasonPlaceholder}
                maxLength={60}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              {ec.save.cancel}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !reason.trim()}>
              {ec.save.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={yamlOpen} onOpenChange={setYamlOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" data-cartograph-region="dialog-yaml">
          <DialogHeader>
            <DialogTitle>{ec.viewAsYaml}</DialogTitle>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            {manifestQuery.data?.yaml}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A year, or a year and month. */
const PERIOD = /^[0-9]{4}(-(0[1-9]|1[0-2]))?$/;

/** A horizon the way people say it: 2025 to 2030, or with months. */
export function span(h: { start: string; end: string } | undefined): string {
  if (!h) return "";
  if (h.start.endsWith("-01") && h.end.endsWith("-12")) return `${h.start.slice(0, 4)} to ${h.end.slice(0, 4)}`;
  return `${h.start} to ${h.end}`;
}

/** The aim's context beside its title: the period it covers and who owns
 * it, so a person always knows what kind of aim they are working on. */
export function AimContext({ horizon, owner }: { horizon?: { start: string; end: string; inherited?: boolean }; owner?: string }) {
  const ownerName = useManifestName("Resource", owner).data ?? owner;
  if (!horizon && !owner) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      {horizon ? (
        <span className="flex items-center gap-1.5" title={ec.horizon.label}>
          <CalendarRange className="size-4" aria-hidden="true" />
          <span className="sr-only">{ec.horizon.label}: </span>
          {span(horizon)}
        </span>
      ) : null}
      {owner ? (
        <span className="flex items-center gap-1.5" title={ec.owner.label}>
          <UserRound className="size-4" aria-hidden="true" />
          <span className="sr-only">{ec.owner.label}: </span>
          {ownerName}
        </span>
      ) : null}
    </div>
  );
}
