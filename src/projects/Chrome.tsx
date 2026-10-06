import { Check, Save } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/error-alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/copy";
import { useProjectChecks } from "./api";
import { useProjectStore, type SaveState } from "./store";
import { STAGES, stepsOfStage, type Stage } from "./types";
import { STAGE_ICON } from "./steps";
import { FlowProgress, type FlowSegment } from "@/components/walker";
import { ConflictNotes } from "@/collab/ConflictNotes";
import { OfflineNote } from "@/collab/OfflineNote";
import { ProposalNotice } from "@/proposals/ProposalNotice";

const pc = copy.projects;

export function SaveStatus({ state }: { state: SaveState }) {
  // data-state is the one dependable hook for "has everything landed":
  // the end-to-end script waits on it before a hard reload, rather than
  // guessing at the debounce.
  const className = state === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground";
  const label =
    state === "saving"
      ? pc.header.saving
      : state === "unsaved"
        ? pc.header.unsaved
        : state === "error"
          ? pc.header.notSaved
          : pc.header.saved;
  return (
    // A save is answered where it happened, quietly (engine DESIGN_RULES
    // "The interface answers"): each change of state fades in, and a
    // landed save draws a check, moving nothing else.
    <span data-slot="save-status" data-state={state} className={`inline-flex items-center gap-1 ${className}`}>
      {state === "saved" ? (
        <Check key="saved" className="size-3.5 text-success animate-in fade-in zoom-in-75 duration-200 ease-enter" aria-hidden="true" />
      ) : null}
      <span key={state} className="animate-in fade-in duration-150 ease-standard">
        {label}
      </span>
    </span>
  );
}

export function SaveVersionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useProjectStore();
  const [reason, setReason] = useState("");
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setConflict(false);
    setError(null);
    const result = await store.saveVersion(reason.trim());
    setSaving(false);
    if (result.ok) {
      onOpenChange(false);
      setReason("");
      return;
    }
    if (result.conflict) {
      setConflict(true);
      return;
    }
    setError(result.problems.map((p) => p.message).join(" ") || pc.common.generalError);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-cartograph-region="dialog-save-version">
        <DialogHeader>
          <DialogTitle>{pc.saveVersionDialog.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{pc.saveVersionDialog.hint}</p>
          {conflict ? <p className="text-sm text-destructive">{pc.common.conflict}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-col gap-2">
            <Label>{pc.common.reasonLabel}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 60))}
              placeholder={pc.common.reasonPlaceholder}
              maxLength={60}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {pc.common.cancel}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !reason.trim()} data-celebrate="">
            {pc.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DiscardDraftDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useProjectStore();
  const [discarding, setDiscarding] = useState(false);

  async function handleDiscard() {
    setDiscarding(true);
    await store.discardDraft();
    setDiscarding(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-cartograph-region="dialog-discard-draft">
        <DialogHeader>
          <DialogTitle>{pc.discardDialog.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{pc.discardDialog.body}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {pc.common.cancel}
          </Button>
          <Button type="button" variant="destructive" disabled={discarding} onClick={handleDiscard}>
            {pc.discardDialog.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The seven stages of a project's definition, as every flow shows its
 * progress (components/walker FlowProgress): a segment per stage, filled
 * by the share of its steps with nothing blocking, its worst check marked,
 * each going to the stage's first step. The lifecycle phases are
 * unchanged underneath (a stage groups the questions; a phase is where the
 * answer belongs).
 */
export function StageStepper({ id, current }: { id: string; current: Stage }) {
  const navigate = useNavigate();
  // Read from the same checks the rail shows (LSS_REVIEW.md, D22).
  const checks = useProjectChecks(id, true);
  const items = checks.data?.items ?? [];
  const stateOf = (section: string) => {
    const here = items.filter((c) => c.section === section);
    if (here.length === 0) return undefined;
    return here.some((c) => c.state === "block") ? "block" : here.some((c) => c.state === "warn") ? "warn" : "ok";
  };
  const segments: FlowSegment[] = STAGES.map((stage) => {
    const steps = stepsOfStage(stage);
    const states = steps.map((s) => stateOf(s.section)).filter((x): x is "ok" | "warn" | "block" => !!x);
    const clear = states.filter((x) => x !== "block").length;
    return {
      key: stage,
      label: pc.stages[stage],
      icon: STAGE_ICON[stage],
      share: states.length ? clear / steps.length : 0,
      state: states.includes("block") ? "block" : states.includes("warn") ? "warn" : states.length === steps.length ? "ok" : undefined,
      title: states.length ? `${pc.stageQuestion[stage]} ${pc.assembly.stageProgress(clear, steps.length)}` : pc.stageQuestion[stage],
    };
  });
  return (
    <div className="min-w-[36rem]" data-cartograph-region="stage-stepper">
      <FlowProgress
        segments={segments}
        at={STAGES.indexOf(current)}
        onGo={(i) => void navigate({ to: `/projects/$id${stepsOfStage(STAGES[i])[0].path}`, params: { id } })}
        label={pc.stepper.label}
      />
    </div>
  );
}

export function ProjectHeaderBar() {
  const store = useProjectStore();
  const [saveOpen, setSaveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" data-cartograph-region="project-header">
        <div className="flex flex-wrap items-center gap-3">
          <SaveStatus state={store.saveState} />
          <OfflineNote />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setDiscardOpen(true)}>
            {pc.header.discardDraft}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setSaveOpen(true)} aria-label={pc.header.saveVersionLabel} title={pc.header.saveVersionLabel}>
            <Save />
            {pc.header.saveVersion}
          </Button>
        </div>
      </div>
      {/* A failed debounced/navigation-flush save (rule: never drops the
          edits, so this is purely a "try sending it again" retry, not a
          discard-and-reload) shows the same stock Alert every other failed
          fetch in this codebase uses. */}
      {store.saveState === "error" ? (
        <ErrorAlert message={pc.header.saveFailed} onRetry={() => void store.flushNow()} />
      ) : null}
      <ConflictNotes conflicts={store.conflicts} onResolve={store.resolveConflict} />
      <ProposalNotice kind="Project" id={store.id} />
      <SaveVersionDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <DiscardDraftDialog open={discardOpen} onOpenChange={setDiscardOpen} />
    </>
  );
}

export function useGoToRecord(id: string) {
  const navigate = useNavigate();
  return () => navigate({ to: "/projects/$id", params: { id } });
}
