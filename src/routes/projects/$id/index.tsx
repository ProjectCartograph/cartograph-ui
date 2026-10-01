import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Circle, Hash } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { copy } from "@/copy";
import { useProjectChecks, useProjectManifest, useProjectState, useProjectVersions } from "@/projects/api";
import { CheckPanel } from "@/projects/CheckPanel";
import { ProjectHeaderBar } from "@/projects/Chrome";
import { useProjectStore, type Problem } from "@/projects/store";
import { ALL_SECTIONS, STAGES, stepsOfStage, deriveTimelineEnd, NEW_OPERATION_ID } from "@/projects/types";
import { STAGE_ICON, stepIcon } from "@/projects/steps";

export const Route = createFileRoute("/projects/$id/")({ component: ProjectRecordPage });

const rc = copy.projects.record;
const pc = copy.projects;

function summarizeSection(section: string, store: ReturnType<typeof useProjectStore>): string {
  const spec = store.spec;
  switch (section) {
    case "goals": {
      const n = spec.alignment?.goals?.length ?? 0;
      return n > 0 ? `${n} outcome${n === 1 ? "" : "s"}` : rc.sectionsEmpty;
    }
    case "measures": {
      const objectives = (spec.objectives ?? []).filter((o) => (o.objective ?? "").trim() !== "");
      if (objectives.length === 0) return rc.sectionsEmpty;
      const first = objectives[0].objective ?? "";
      return objectives.length === 1 ? first : `${objectives.length} objectives · ${first}`;
    }
    case "stakeholders": {
      return rc.sectionsEmpty;
    }
    case "success": {
      const n = (spec.successCriteria ?? []).length;
      return n > 0 ? `${n} criteri${n === 1 ? "on" : "a"}` : rc.sectionsEmpty;
    }
    case "beneficiaries": {
      const groups = spec.summary.beneficiaries?.length ?? 0;
      return groups > 0 ? `${groups} group${groups === 1 ? "" : "s"}` : rc.sectionsEmpty;
    }
    case "aim": {
      const lines = (spec.summary.problems ?? []).filter((l) => (l.problem?.situation ?? "").trim() !== "");
      if (lines.length === 0) return rc.sectionsEmpty;
      const first = (lines[0].problem?.situation ?? "").trim();
      return lines.length === 1 ? first : `${lines.length} problems · ${first}`;
    }
    case "scope": {
      const inCount = spec.summary.scopeIn?.length ?? 0;
      const outCount = spec.summary.scopeOut?.length ?? 0;
      if (inCount + outCount === 0) return rc.sectionsEmpty;
      return `${inCount} in, ${outCount} out`;
    }
    case "deliverables": {
      const items = spec.deliverables ?? [];
      if (items.length === 0) return rc.sectionsEmpty;
      const first = items[0].name || rc.sectionsEmpty;
      return items.length > 1 ? rc.plusMore(first, items.length - 1) : first;
    }

    case "timeline": {
      const phases = spec.timeline?.phases ?? [];
      if (phases.length === 0) return rc.sectionsEmpty;
      const end = deriveTimelineEnd(spec.timeline);
      const count = `${phases.length} phase${phases.length === 1 ? "" : "s"}`;
      return end ? `${count}, ${rc.endsWord} ${end}` : count;
    }
    case "resources": {
      const roles = (spec.resources ?? []).length;
      const funded = (spec.funding ?? []).length;
      if (roles + funded === 0) return rc.sectionsEmpty;
      const parts = [`${roles} role${roles === 1 ? "" : "s"}`];
      if (funded > 0) parts.push(`${funded} funding line${funded === 1 ? "" : "s"}`);
      return parts.join(", ");
    }
    case "data": {
      const n = (spec.data?.consumes?.length ?? 0) + (spec.data?.produces?.length ?? 0);
      return n > 0 ? `${n} data line${n === 1 ? "" : "s"}` : rc.sectionsEmpty;
    }
    case "risks": {
      const n = spec.risks?.length ?? 0;
      return n > 0 ? `${n} line${n === 1 ? "" : "s"}` : rc.sectionsEmpty;
    }
    case "closing": {
      const n = (spec.successCriteria ?? []).filter((c) => c.when === "atClosing").length;
      return n > 0 ? `${n} test line${n === 1 ? "" : "s"}` : rc.sectionsEmpty;
    }
    case "landing": {
      const n = (spec.successCriteria ?? []).filter((c) => c.when !== "atClosing").length;
      if (!spec.operation) return rc.sectionsEmpty;
      const operationLabel = spec.operation === NEW_OPERATION_ID ? copy.projects.landing.defineNewOperation : spec.operation;
      return `${operationLabel} · ${n} test line${n === 1 ? "" : "s"}`;
    }
    default:
      return rc.sectionsEmpty;
  }
}

function ProjectRecordPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const store = useProjectStore();
  const manifestQuery = useProjectManifest(id);
  const checksQuery = useProjectChecks(id, true);
  const stateQuery = useProjectState(id);
  const versionsQuery = useProjectVersions(id);
  const [yamlOpen, setYamlOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveProblems, setSaveProblems] = useState<Problem[]>([]);

  const blocking = checksQuery.data?.blocking ?? 0;

  if (!store.loaded) {
    return <p className="text-sm text-muted-foreground">{rc.loading}</p>;
  }
  if (store.loadError) {
    return <p className="text-sm text-destructive">{rc.error}</p>;
  }

  async function handleSaveVersion() {
    if (!reason.trim()) return;
    setIsSaving(true);
    setSaveProblems([]);
    try {
      const result = await store.saveVersion(reason);
      if (result.ok) {
        setSaveDialogOpen(false);
        setReason("");
      } else {
        setSaveProblems(result.problems);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleHandoff() {
    navigate({ to: `/projects/${id}/handoff` });
  }

  const statePill = () => {
    const state = stateQuery.data?.state ?? "draft";
    if (state === "draft") return "draft";
    const versions = versionsQuery.data ?? [];
    const latestVersion = versions.length > 0 ? versions[0]?.number : 0;
    if (latestVersion > 0) return `${state} · snapshot ${latestVersion}`;
    return state;
  };

  return (
    <div className="flex flex-col gap-4">
      <ProjectHeaderBar />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
            <Badge variant="secondary">{statePill()}</Badge>
          </div>
          {/* The reference people quote this by, which is not the id:
              that one is fixed once chosen and every mention resolves
              against it (Programme Lead, 2026-09-29). */}
          <div className="flex items-center gap-1.5">
          <Hash className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            data-cartograph-field="/metadata/alias"
            value={store.alias}
            onChange={(e) => store.setAlias(e.target.value.slice(0, 80))}
            placeholder={copy.alias.placeholder}
            aria-label={copy.alias.label}
            title={copy.alias.hint}
            maxLength={80}
            className="h-7 w-64 font-mono text-xs text-muted-foreground"
          />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleHandoff} disabled={stateQuery.data?.state === "handed off"}>
            Hand off
          </Button>
          <Button asChild variant="outline">
            <Link to="/projects/$id/framework" params={{ id }}>
              {copy.framework.title}
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setYamlOpen(true)}>
            {rc.viewYaml}
          </Button>
        </div>
      </div>
      {blocking > 0 ? <p className="text-sm text-muted-foreground">{pc.header.blockingHint(blocking)}</p> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[16rem_1fr_18rem]">
        {/* The definition, by stage: Align, Quality, Refine, Polish. The
            marks carry the grouping so each row is one word and its own
            state, rather than a phase heading repeated down the column. */}
        <div className="flex flex-col gap-1" data-cartograph-region="section-rail">
          {STAGES.map((stage) => {
            const StageIcon = STAGE_ICON[stage];
            return (
              <div key={stage} className="flex flex-col gap-1 pt-2 first:pt-0">
                <p
                  className="flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground uppercase"
                  title={pc.stageQuestion[stage]}
                >
                  <StageIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  {pc.stages[stage]}
                </p>
                {stepsOfStage(stage).map((step) => (
                  <SectionRow key={step.section} id={id} section={step.section} path={step.path} />
                ))}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3" data-cartograph-region="sections">
          {ALL_SECTIONS.map((s) => {
            const Icon = stepIcon(s.section);
            return (
              <div key={s.section} className="rounded-lg border p-3" data-cartograph-region={`section-${s.section}`}>
                <p className="flex items-center gap-2 text-sm font-medium">
                  {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
                  {pc.sections[s.section] ?? s.section}
                </p>
                <p className="text-sm text-muted-foreground">{summarizeSection(s.section, store)}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <CheckPanel id={id} draft />
        </div>
      </div>

      <Dialog open={yamlOpen} onOpenChange={setYamlOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" data-cartograph-region="dialog-yaml">
          <DialogHeader>
            <DialogTitle>{rc.viewYaml}</DialogTitle>
          </DialogHeader>
          <Textarea readOnly value={manifestQuery.data?.yaml ?? ""} className="h-96 font-mono text-xs" />
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md" data-cartograph-region="dialog-save-version">
          <DialogHeader>
            <DialogTitle>{copy.projects.saveVersionDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{copy.projects.saveVersionDialog.hint}</p>
            {saveProblems.length > 0 ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>This version has problems</AlertTitle>
                <div className="mt-2 space-y-1 text-sm">
                  {saveProblems.map((p, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-mono text-destructive">{p.path}</span>: {p.message}
                    </div>
                  ))}
                </div>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="reason">{copy.projects.common.reasonLabel}</Label>
              <Input
                id="reason"
                placeholder={copy.projects.common.reasonPlaceholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveVersion}
                disabled={!reason.trim() || isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionRow({ id, section, path }: { id: string; section: string; path: string }) {
  const checksQuery = useProjectChecks(id, true);
  const items = (checksQuery.data?.items ?? []).filter((i) => i.section === section);
  const rank = (s: string) => (s === "block" ? 2 : s === "warn" ? 1 : 0);
  const worst = items.reduce<string | undefined>((acc, i) => (!acc || rank(i.state) > rank(acc) ? i.state : acc), undefined);
  const label = copy.projects.sections[section] ?? copy.projects.stepper[section as "closing" | "landing"];

  return (
    <Link
      // Assembled generically from a fixed, known set of registered routes;
      // the router's own literal-union route typing cannot express that
      // statically (see CheckPanel.tsx's goToFix for the same shape).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({ to: `/projects/$id${path}`, params: { id } } as any)}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
    >
      {worst === "block" ? (
        <Circle className="size-2 shrink-0 fill-destructive text-destructive" />
      ) : worst === "warn" ? (
        <Circle className="size-2 shrink-0 fill-muted-foreground text-muted-foreground" />
      ) : worst === "ok" ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Circle className="size-2 shrink-0 fill-border text-border" />
      )}
      <span className="truncate">{label}</span>
    </Link>
  );
}
