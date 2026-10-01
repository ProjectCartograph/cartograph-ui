import { useState } from "react";
import { CornerDownRight, Flag, Plus, Waypoints, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import { useDefinitionStore, useSectionAutosave } from "@/definition/store";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { SheetAddDialog } from "@/surfaces/sheet/InlineSheetAdd";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import { canRestOn, nextStepID, pathwayCards } from "../pathway";
import type { PathwayStep, ProgrammeSpec } from "../types";

const pc = copy.programmes.pathway;

/**
 * How this programme believes the change happens, written backwards.
 *
 * Name the outcome the programme is for, then ask what has to be true
 * before it — and add that *from the step that needs it*, which is what
 * makes the edge. Picking a precondition from a list was the earlier
 * design and it could not work: the list is empty until something has
 * been created, and the thing to create it from was the step doing the
 * asking (Programme Lead, 2026-09-29).
 *
 * The picker is still here for the case creation cannot cover: two steps
 * that need the same precondition. It appears only when there is
 * something to pick.
 *
 * Deliberately not the goal tree. That tree says where a goal files; this
 * says what produces what, and one outcome can rest on several
 * (TAXONOMY.md D12, D13). The reasoning on each step is the point: an
 * arrow with nothing written on it is a picture, and cannot be argued
 * with.
 */
export function PathwaySection() {
  useSectionAutosave();
  const store = useDefinitionStore<ProgrammeSpec>();
  const { data: goals } = useReferenceOptions("Goal");
  const { data: assumptions } = useReferenceOptions("Assumption");
  const [addingAssumption, setAddingAssumption] = useState<number | null>(null);
  // A step created under another, until picking its goal makes the edge
  // real. Keyed by step id, which is why a step created here gets one.
  const [pending, setPending] = useState<Record<string, string>>({});
  // Linking a step to a precondition somebody already wrote is the rare
  // case; it is offered, not laid out. A step that already shares one
  // shows the picker without being asked.
  const [sharing, setSharing] = useState<string | null>(null);

  const steps = store.spec.pathway ?? [];
  const goalOptions = goals?.options ?? [];
  const goalName = (id: string) => goals?.names.get(id) ?? id;
  const cards = pathwayCards(steps, pending);

  function setSteps(next: PathwayStep[]) {
    store.updateSpec((s) => ({ ...s, pathway: next.length > 0 ? next : undefined }));
  }

  function update(at: number, patch: Partial<PathwayStep>) {
    setSteps(steps.map((s, i) => (i === at ? { ...s, ...patch } : s)));
  }

  /** Picking the goal is what makes the edge: the step that asked for
   * this precondition gains it in `from`, and the pairing is spent. */
  function setOutcome(at: number, outcome: string | undefined) {
    const step = steps[at];
    const parentID = step?.id ? pending[step.id] : undefined;
    const parentAt = parentID ? steps.findIndex((s) => s.id === parentID) : -1;

    setSteps(
      steps.map((s, i) => {
        if (i === at) return { ...s, outcome };
        if (i === parentAt && outcome) {
          const from = s.from ?? [];
          return from.includes(outcome) ? s : { ...s, from: [...from, outcome] };
        }
        return s;
      }),
    );
    const childID = step?.id;
    if (outcome && childID && parentID) {
      setPending((held) => {
        const next = { ...held };
        delete next[childID];
        return next;
      });
    }
  }

  /** A new step at the earliest end of the file, remembered as this
   * step's precondition until its goal is picked. */
  function addPrecondition(parentAt: number) {
    const parent = steps[parentAt];
    const parentID = parent.id ?? nextStepID(steps);
    const withParentID = steps.map((s, i) => (i === parentAt ? { ...s, id: parentID } : s));
    const childID = nextStepID(withParentID);
    setSteps([{ id: childID }, ...withParentID]);
    setPending((held) => ({ ...held, [childID]: parentID }));
  }

  function removeStep(at: number) {
    const gone = steps[at]?.outcome;
    setSteps(
      steps
        .filter((_, i) => i !== at)
        // An edge to a step that no longer exists is not an edge.
        .map((s) => {
          const from = (s.from ?? []).filter((id) => id !== gone);
          return from.length > 0 ? { ...s, from } : { ...s, from: undefined };
        }),
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <FieldHeading label={pc.label} hint={pc.hint} />

      {cards.length === 0 ? <p className="text-sm text-muted-foreground">{pc.empty}</p> : null}

      {cards.map(({ step, at, role, depth, startsHere, sharedFrom }) => {
        const offered = canRestOn(steps, at).filter((id) => !(step.from ?? []).includes(id));
        const shareable = offered.length > 0 || sharedFrom.length > 0;
        const Mark = role === "outcome" ? Flag : Waypoints;
        return (
          <div
            key={step.id ?? at}
            data-slot="pathway-step"
            // The indent is the depth: what a step rests on is drawn
            // under it, so the tree is read rather than reconstructed.
            style={{ marginLeft: `${Math.min(depth, 6) * 1.5}rem` }}
            className="flex flex-col gap-3 rounded-xl border p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <Badge variant={role === "outcome" ? "secondary" : "outline"} className="gap-1">
                <Mark aria-hidden="true" />
                {role === "outcome" ? pc.outcomeBadge : pc.preconditionBadge}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={copy.projects.common.remove}
                onClick={() => removeStep(at)}
              >
                <X />
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <FieldHeading
                label={role === "outcome" ? pc.outcomeLabel : pc.preconditionLabel}
                hint={role === "outcome" ? pc.outcomeHint : pc.preconditionHint}
              />
              <ReferencePicker
                refKind="Goal"
                value={step.outcome}
                onChange={(v) => setOutcome(at, v || undefined)}
                placeholder={pc.outcomePlaceholder}
                label={role === "outcome" ? pc.outcomeLabel : pc.preconditionLabel}
              />
            </div>

            <div className="flex flex-col gap-2">
              <FieldHeading
                label={pc.becauseLabel}
                hint={role === "outcome" ? pc.becauseHint : pc.becausePreconditionHint}
                htmlFor={`pathway-because-${at}`}
              />
              <Textarea
                id={`pathway-because-${at}`}
                rows={2}
                maxLength={400}
                value={step.because ?? ""}
                placeholder={pc.becausePlaceholder}
                onChange={(e) => update(at, { because: e.target.value || undefined })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <FieldHeading label={pc.assumesLabel} hint={pc.assumesHint} />
              <ComboboxMultiple
                options={assumptions?.options ?? []}
                value={step.assumes ?? []}
                onValueChange={(next) => update(at, { assumes: next.length > 0 ? next : undefined })}
                placeholder={pc.assumesPlaceholder}
                emptyText={pc.assumesNone}
                removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
                aria-label={pc.assumesLabel}
                onAdd={() => setAddingAssumption(at)}
                addLabel={pc.assumesAdd}
              />
            </div>

            {/* Only where there is something to share: a precondition two
                steps both need is the one case adding cannot cover. */}
            {shareable && sharedFrom.length === 0 && sharing !== (step.id ?? String(at)) ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto self-start p-0 text-xs text-muted-foreground"
                onClick={() => setSharing(step.id ?? String(at))}
              >
                {pc.alsoRestsOnReveal}
              </Button>
            ) : null}
            {shareable && (sharedFrom.length > 0 || sharing === (step.id ?? String(at))) ? (
              <div className="flex flex-col gap-2">
                <FieldHeading label={pc.alsoRestsOnLabel} hint={pc.alsoRestsOnHint} />
                <ComboboxMultiple
                  options={goalOptions.filter(
                    (o) => offered.includes(o.value) || sharedFrom.includes(o.value),
                  )}
                  value={sharedFrom}
                  onValueChange={(next) => {
                    const own = (step.from ?? []).filter((id) => !sharedFrom.includes(id));
                    const from = [...own, ...next];
                    update(at, { from: from.length > 0 ? from : undefined });
                  }}
                  placeholder={pc.alsoRestsOnPlaceholder}
                  emptyText={pc.fromNone}
                  removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
                  aria-label={pc.alsoRestsOnLabel}
                />
              </div>
            ) : null}

            {(step.from ?? []).length > 1 ? (
              <p className="text-xs text-muted-foreground">
                {pc.allOf((step.from ?? []).map(goalName))}
              </p>
            ) : null}

            {step.outcome && startsHere ? (
              <p className="text-xs text-muted-foreground">{pc.startsHere(goalName(step.outcome))}</p>
            ) : null}

            {/* The action that makes an edge: a precondition is created
                by the step that needs it, and lands indented under it. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => addPrecondition(at)}
            >
              <CornerDownRight />
              {pc.addPrecondition}
            </Button>
          </div>
        );
      })}

      <SheetAddDialog
        kind="Assumption"
        open={addingAssumption !== null}
        onOpenChange={(open) => setAddingAssumption(open ? addingAssumption : null)}
        onAdded={(id) => {
          if (addingAssumption === null) return;
          const step = steps[addingAssumption];
          update(addingAssumption, { assumes: [...(step?.assumes ?? []), id] });
        }}
      />

      {cards.length === 0 ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setSteps([{ id: nextStepID(steps) }])}
        >
          <Plus />
          {pc.addOutcome}
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => setSteps([...steps, { id: nextStepID(steps) }])}
        >
          <Plus />
          {pc.addOutcome}
        </Button>
      )}
    </div>
  );
}
