import { ChevronDown, ChevronRight, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ComboboxMultiple } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import type { RefOption } from "@/surfaces/sheet/useReferenceOptions";
import { GapCitations } from "./GapCitations";
import { ProblemMap } from "./ProblemMap";
import { seg } from "./field";
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
  list = "/spec/summary/problems",
  onAddGroup,
  project,
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
  /** Where the list of problems sits in the manifest, by JSON pointer: a
   * project keeps it under its summary, a programme in its spec. */
  list?: string;
  /** Names a group the problem's gaps affect: on a project, also among
   * its beneficiaries. Left out, the group joins the problem alone. */
  onAddGroup?: (group: string) => void;
  /** The project the problem belongs to, for drawing its links; a
   * programme's problems are linked through their fields alone. */
  project?: string;
}) {
  const groups = line.groups ?? [];
  const groupNames = groups.map((g) => groupOptions.find((o) => o.value === g)?.label ?? g);
  // The collapsed card shows the parts as they were written. Nothing is
  // joined into a sentence: a tool cannot promise the grammar of a
  // sentence it assembles (TAXONOMY.md D19).
  const problem = (line.problem?.situation ?? "").trim();
  const change = (line.change?.what ?? "").trim();
  const Chevron = open ? ChevronDown : ChevronRight;
  const field = `${list}/${seg(line, index)}`;

  return (
    <div data-slot="problem-card" data-cartograph-region={`problem-${index}`} className="flex flex-col rounded-xl ring-1 ring-foreground/10">
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
        <div className="flex flex-col gap-5 border-t p-4">
          <Lead text={ac.statement.defined}>
            <Textarea
              data-cartograph-field={`${field}/problem/situation`}
              aria-label={ac.problemLabel}
              value={line.problem?.situation ?? ""}
              maxLength={600}
              rows={2}
              className="field-sizing-content min-h-0"
              onChange={(e) => onChange({ problem: { ...line.problem, situation: e.target.value } })}
            />
          </Lead>
          <Lead text={ac.statement.cause}>
            <Textarea
              data-cartograph-field={`${field}/problem/cause`}
              aria-label={ac.causeLabel}
              value={line.problem?.cause ?? ""}
              maxLength={600}
              rows={1}
              className="field-sizing-content min-h-0"
              onChange={(e) => onChange({ problem: { ...line.problem, cause: e.target.value || undefined } as ProblemLine["problem"] })}
            />
          </Lead>
          <Lead text={ac.statement.gaps}>
            <GapCitations
              data-cartograph-field={`${field}/gaps`}
              value={line.gaps ?? []}
              onChange={(next) => onChange({ gaps: next.length > 0 ? next : undefined })}
            />
          </Lead>
          <Lead text={ac.statement.groups}>
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
                data-cartograph-field={`${field}/groups`}
              />
            )}
          </Lead>
          <Lead text={ac.statement.change}>
            <Textarea
              data-cartograph-field={`${field}/change/what`}
              aria-label={ac.changeLabel}
              value={line.change?.what ?? ""}
              maxLength={600}
              rows={2}
              className="field-sizing-content min-h-0"
              onChange={(e) => onChange({ change: { ...line.change, what: e.target.value } })}
            />
          </Lead>
          <Lead text={ac.statement.gain}>
            <Textarea
              data-cartograph-field={`${field}/change/gain`}
              aria-label={ac.changeGainLabel}
              value={line.change?.gain ?? ""}
              maxLength={600}
              rows={1}
              className="field-sizing-content min-h-0"
              onChange={(e) => onChange({ change: { ...line.change, gain: e.target.value || undefined } as ProblemLine["change"] })}
            />
          </Lead>
          <ProblemMap
            line={line}
            groupNames={new Map(groupOptions.map((o) => [o.value, o.label]))}
            onAddGroup={(g) => (onAddGroup ? onAddGroup(g) : onChange({ groups: [...groups, g] }))}
            onChange={onChange}
            project={project}
            problem={line.id ?? `#${index}`}
            showGraph={!project}
          />
        </div>
      ) : null}
    </div>
  );
}

/** One part of the statement: the words that lead into it, then the
 * field that finishes it. */
function Lead({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
