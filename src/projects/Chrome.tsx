import { Check } from "lucide-react";
import { ProgressRing } from "@/components/ProgressRing";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
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
          <Button type="button" onClick={handleSave} disabled={saving || !reason.trim()}>
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

/** Initiation, Closing, Landing: the three-phase stepper every journey
 * screen shows in its header (rule 3). */
/**
 * The four stages of a definition, as marks with one word each: Align,
 * Quality, Refine, Polish. Each jumps to the first step of its stage.
 * The stage a person is in is filled; the ones behind it are quiet; the
 * ones ahead are outlines. The lifecycle phases are unchanged underneath
 * (a stage groups the questions; a phase is where the answer belongs).
 */
export function StageStepper({ id, current }: { id: string; current: Stage }) {
  const currentIdx = STAGES.indexOf(current);
  // A ring per stage, filled by the share of its steps with nothing
  // blocking, read from the same checks the rail shows (LSS_REVIEW.md, D22).
  const checks = useProjectChecks(id, true);
  const blocked = new Set((checks.data?.items ?? []).filter((c) => c.state === "block").map((c) => c.section));
  const checked = new Set((checks.data?.items ?? []).map((c) => c.section));
  return (
    <div className="flex shrink-0 items-center gap-1.5" data-cartograph-region="stage-stepper">
      {STAGES.map((stage, i) => {
        const first = stepsOfStage(stage)[0];
        const Icon = STAGE_ICON[stage];
        return (
          <Link
            key={stage}
            to={`/projects/$id${first.path}`}
            params={{ id }}
            title={pc.stageQuestion[stage]}
            aria-current={stage === current ? "step" : undefined}
          >
            <Badge
              variant={stage === current ? "current" : i < currentIdx ? "secondary" : "outline"}
              className="gap-1"
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {pc.stages[stage]}
              {(() => {
                const steps = stepsOfStage(stage).filter((s) => checked.has(s.section));
                if (steps.length === 0) return null;
                const clear = steps.filter((s) => !blocked.has(s.section)).length;
                return (
                  <ProgressRing
                    value={clear / steps.length}
                    size={12}
                    label={pc.assembly.stageProgress(clear, steps.length)}
                    className="ml-0.5 text-success"
                  />
                );
              })()}
            </Badge>
          </Link>
        );
      })}
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
          <Button type="button" variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
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
