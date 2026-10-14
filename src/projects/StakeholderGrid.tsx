import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Help } from "@/components/guidance";
import { copy } from "@/copy";
import { X } from "lucide-react";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { StakeholderEntry, StakeholderTier } from "./types";

/** An entry's identity on the map: the resource or the group it scores,
 * each scored once. A resource and a group may share an id. */
function keyOf(e: StakeholderEntry): string {
  return e.group ? `group:${e.group}` : `resource:${e.resource ?? ""}`;
}

const pc = copy.projects.resources;

/** Influence 3 to 1 down the rows, interest 1 to 3 across the columns, so
 * every value the schema allows has a cell. Only the four corners carry
 * the familiar quadrant names. */
const GRID_ROWS = [3, 2, 1];
const GRID_COLS = [1, 2, 3];

function quadrantKey(influence: number, interest: number): string | null {
  if (influence === 3 && interest === 1) return "keepSatisfied";
  if (influence === 3 && interest === 3) return "manageClosely";
  if (influence === 1 && interest === 1) return "monitor";
  if (influence === 1 && interest === 3) return "keepInformed";
  return null;
}

const TIERS: StakeholderTier[] = ["primary", "secondary"];
const LEVELS = [1, 2, 3] as const;

/** How to manage a party, from where it sits: the four familiar approaches,
 * the middle of each scale counting as high. */
function approachOf(influence: number, interest: number): string {
  if (influence >= 2) return interest >= 2 ? "manageClosely" : "keepSatisfied";
  return interest >= 2 ? "keepInformed" : "monitor";
}

/**
 * How much power each stakeholder holds over this project.
 *
 * It scores a Resource, not one of the project's own rows: a resource is
 * declared once and used across many projects, and the power it holds is
 * particular to each, so the score lives on the StakeholderMap bound to
 * this project (Programme Lead, 2026-09-28). The party need not be one the
 * project references — somebody with power over a project is often not
 * part of it.
 *
 * Pure: it takes the entries and hands back the next ones. The map it
 * edits belongs to a project on one step and to a programme on another,
 * and those are different stores — the grid should not have to know
 * which.
 *
 * An entry with no score renders as itself. Naming a stakeholder and
 * placing one are separate acts, and the unplaced state is the one this
 * whole shape exists to hold.
 */
export function StakeholderGrid({
  entries,
  groups = [],
  onChange,
}: {
  entries: StakeholderEntry[];
  /** The work's own beneficiary groups, offered first: the people it is
   * for are stakeholders too, and need not be recorded again as
   * Resources (TAXONOMY.md D42). */
  groups?: string[];
  onChange: (next: StakeholderEntry[]) => void;
}) {
  const { data: resources } = useReferenceOptions("Resource");
  const { data: groupOptions } = useReferenceOptions("BeneficiaryGroup");

  function setEntries(next: StakeholderEntry[]) {
    onChange(next);
  }
  function updateAt(idx: number, patch: Partial<StakeholderEntry>) {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  /** Every group and Resource not already scored: one score per
   * stakeholder is a kind rule, so an entry that exists is not offered
   * again. The work's own groups come first. */
  const scored = new Set(entries.map(keyOf));
  const ownGroups = groups.filter((g) => !scored.has(`group:${g}`));
  const unscored = (resources?.options ?? []).filter((r) => !scored.has(`resource:${r.value}`));
  const nameOf = (e: StakeholderEntry) =>
    e.group ? (groupOptions?.names.get(e.group) ?? e.group) : (resources?.names.get(e.resource ?? "") ?? e.resource ?? "");

  return (
    <div className="flex flex-col gap-3" data-slot="stakeholder-grid" data-cartograph-region="stakeholder-grid">
      <div className="flex items-center gap-1">
        <h3 className="text-sm font-medium">{pc.gridTitle}</h3>
        <Help label={pc.gridTitle} hint={pc.gridHint} />
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((e, idx) => (
          <div key={keyOf(e)} data-cartograph-region={`stakeholder-${idx}`} className="flex flex-col gap-2 rounded-lg border p-2">
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-sm font-medium text-pretty">{nameOf(e)}</span>
            <span className="text-xs text-muted-foreground">
              {e.influence !== undefined && e.interest !== undefined ? pc.gridQuadrant[approachOf(e.influence, e.interest)] : pc.unplaced}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => setEntries(entries.filter((_, i) => i !== idx))}
              aria-label={copy.projects.common.remove}
            >
              <X />
            </Button>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            className="self-start"
            value={e.tier ?? ""}
            onValueChange={(v) => updateAt(idx, { tier: (v || undefined) as StakeholderTier })}
            aria-label={`${pc.tierLabel} ${nameOf(e)}`}
            data-cartograph-field={`/spec/entries/${idx}/tier`}
          >
            {TIERS.map((t) => (
              <ToggleGroupItem key={t} value={t}>
                {pc.tier[t]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {/* Where it sits, in words: how much power it has over the
              work, and how much it cares (#40). */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {(["influence", "interest"] as const).map((axis) => (
              <div key={axis} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{axis === "influence" ? pc.influenceLabel : pc.interestLabel}</span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={e[axis] !== undefined ? String(e[axis]) : ""}
                  onValueChange={(v) => updateAt(idx, { [axis]: v ? Number(v) : undefined })}
                  aria-label={`${axis === "influence" ? pc.influenceLabel : pc.interestLabel} ${nameOf(e)}`}
                  data-cartograph-field={`/spec/entries/${idx}/${axis}`}
                >
                  {LEVELS.map((l) => (
                    <ToggleGroupItem key={l} value={String(l)}>
                      {pc.levels[l]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
          </div>
          {/* What this party cares about here, and who keeps the
              relationship (TAXONOMY.md D42). The map holds no roles of its
              own, so the owner is a catalogue entry, a governance body
              among them. */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              data-cartograph-field={`/spec/entries/${idx}/stake`}
              value={e.stake ?? ""}
              onChange={(ev) => updateAt(idx, { stake: ev.target.value.slice(0, 160) || undefined })}
              aria-label={`${pc.stakeLabel} ${nameOf(e)}`}
              placeholder={pc.stakeLabel}
              maxLength={160}
              className="min-w-48 flex-1"
            />
            <div className="w-56">
              <ReferencePicker
                data-cartograph-field={`/spec/entries/${idx}/owner`}
                refKind="Resource"
                value={e.owner?.kind === "Resource" ? e.owner.id : undefined}
                onChange={(id) => updateAt(idx, { owner: id ? { kind: "Resource", id } : undefined })}
                label={`${pc.relationshipOwnerLabel} ${nameOf(e)}`}
                placeholder={pc.relationshipOwnerLabel}
              />
            </div>
          </div>
          </div>
        ))}

        {ownGroups.length > 0 || unscored.length > 0 ? (
          <Select
            value=""
            onValueChange={(v) => {
              if (v.startsWith("group:")) setEntries([...entries, { group: v.slice(6) }]);
              else if (v.startsWith("resource:")) setEntries([...entries, { resource: v.slice(9) }]);
            }}
          >
            <SelectTrigger className="w-64" aria-label={pc.addToGrid} data-cartograph-field="/spec/entries/-">
              <SelectValue placeholder={pc.addToGrid} />
            </SelectTrigger>
            <SelectContent>
              {ownGroups.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>{pc.ownGroups}</SelectLabel>
                  {ownGroups.map((g) => (
                    <SelectItem key={`group:${g}`} value={`group:${g}`}>
                      {groupOptions?.names.get(g) ?? g}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {unscored.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>{pc.catalogue}</SelectLabel>
                  {unscored.map((r) => (
                    <SelectItem key={`resource:${r.value}`} value={`resource:${r.value}`}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {entries.length > 0 ? <Grid entries={entries} nameOf={nameOf} /> : null}
    </div>
  );
}

/** The nine cells, each naming the parties placed in it: a picture of
 * where power lies, read without a legend. Parties are placed on their
 * rows above, in words. */
function Grid({ entries, nameOf }: { entries: StakeholderEntry[]; nameOf: (e: StakeholderEntry) => string }) {
  return (
    <div className="flex flex-col gap-2" data-cartograph-region="stakeholder-matrix">
      <div className="flex gap-2">
        <span className="flex items-center justify-center text-[10px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          {pc.influenceLabel}
        </span>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-3 gap-1">
            {GRID_ROWS.flatMap((influence) =>
              GRID_COLS.map((interest) => {
                const key = quadrantKey(influence, interest);
                const inCell = entries.filter((e) => e.influence === influence && e.interest === interest);
                return (
                  <div
                    key={`${influence}-${interest}`}
                    data-slot="grid-cell"
                    data-influence={influence}
                    data-interest={interest}
                    aria-label={`${pc.influenceLabel} ${pc.levels[influence]}, ${pc.interestLabel} ${pc.levels[interest]}`}
                    className="flex min-h-16 flex-col items-start gap-1 rounded-md border bg-card p-1.5 text-left text-[10px] leading-tight"
                  >
                    <span className="text-muted-foreground">{key ? pc.gridQuadrant[key] : ""}</span>
                    {inCell.map((e) => (
                      <span key={keyOf(e)} className="text-xs font-medium">
                        {nameOf(e)}
                      </span>
                    ))}
                  </div>
                );
              }),
            )}
          </div>
          <p className="pt-1 text-center text-[10px] text-muted-foreground">{pc.interestLabel}</p>
        </div>
      </div>
    </div>
  );
}
