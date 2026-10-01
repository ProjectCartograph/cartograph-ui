import { ChevronDown, ChevronRight, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { FieldHeading } from "@/components/guidance";
import { copy } from "@/copy";
import type { RefOption } from "@/surfaces/sheet/useReferenceOptions";
import { GapCitations } from "./GapCitations";
import { ChangeEditor, ProblemEditor } from "./StatementEditor";
import type { ProblemLine } from "./types";

const ac = copy.projects.aim;

/**
 * One problem and the change that answers it.
 *
 * A project may answer several (Programme Lead, 2026-09-27), and the
 * editor for one pair is eight fields tall, so four of them stacked open
 * would be a scroll with no shape to it. Shut, a card is its own two
 * sentences and the groups that feel them; open, it is the same parts
 * editor as before. Only one card is open at a time, which is what keeps
 * the step one screen however many problems it holds.
 */
export function ProblemCard({
  line,
  index,
  open,
  onOpenChange,
  groupOptions,
  onChange,
  onRemove,
  canRemove,
}: {
  line: ProblemLine;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The project's own beneficiary groups, as options: a problem is felt
   * by some of the people the project is for, never by a group nobody
   * named. */
  groupOptions: RefOption[];
  onChange: (patch: Partial<ProblemLine>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const groups = line.groups ?? [];
  const groupNames = groups.map((g) => groupOptions.find((o) => o.value === g)?.label ?? g);
  // The collapsed card shows the parts as they were written. Nothing is
  // joined into a sentence: a tool cannot promise the grammar of a
  // sentence it assembles (TAXONOMY.md D19).
  const problem = (line.problem?.situation ?? "").trim();
  const change = (line.change?.what ?? "").trim();
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div data-slot="problem-card" className="flex flex-col rounded-xl ring-1 ring-foreground/10">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={open ? ac.collapse : ac.expand}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <Chevron className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-medium text-muted-foreground">
            {ac.problemBadge(index + 1)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={`text-sm text-pretty ${problem ? "" : "text-muted-foreground"}`}>
              {problem || ac.problemUnwritten}
            </span>
            {change ? (
              <span className="text-sm text-pretty text-muted-foreground">{change}</span>
            ) : null}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              {groupNames.length > 0 ? groupNames.join(", ") : ac.problemGroupsEmpty}
            </span>
          </span>
        </button>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onRemove}
            aria-label={ac.removeProblem}
            title={ac.removeProblem}
          >
            <X />
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="flex flex-col gap-6 border-t p-4">
          <div className="flex flex-col gap-2">
            <FieldHeading label={ac.problemGroupsLabel} />
            {groupOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ac.problemGroupsNone}</p>
            ) : (
              <ComboboxMultiple
                options={groupOptions}
                value={groups}
                onValueChange={(next) => onChange({ groups: next })}
                placeholder={ac.problemGroupsPlaceholder}
                emptyText={copy.sheets.dialog.noMatches}
                removeLabel={(name) => `${copy.projects.common.remove} ${name}`}
                aria-label={ac.problemGroupsLabel}
              />
            )}
          </div>

          {/* The gaps this problem answers. A citation, not a restatement:
              a gap is what is wrong and how we know, written once in the
              register; the problem says what that does to these groups,
              here. Optional, because a problem nobody has traced to
              evidence is still a problem. */}
          <div className="flex flex-col gap-2">
            <FieldHeading label={ac.problemGapsLabel} hint={ac.problemGapsHint} />
            <GapCitations
              value={line.gaps ?? []}
              onChange={(next) => onChange({ gaps: next.length > 0 ? next : undefined })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <FieldHeading label={ac.problemLabel} />
            <ProblemEditor
              value={line.problem}
              groups={groupNames}
              onChange={(v) => onChange({ problem: v })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <FieldHeading label={ac.changeLabel} />
            <ChangeEditor
              value={line.change}
              groups={groupNames}
              onChange={(v) => onChange({ change: v })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
