import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Help } from "@/components/guidance";
import { copy } from "@/copy";
import { X } from "lucide-react";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { StakeholderEntry, StakeholderTier } from "./types";

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
  onChange,
}: {
  entries: StakeholderEntry[];
  onChange: (next: StakeholderEntry[]) => void;
}) {
  const { data: resources } = useReferenceOptions("Resource");

  function setEntries(next: StakeholderEntry[]) {
    onChange(next);
  }
  function updateAt(idx: number, patch: Partial<StakeholderEntry>) {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  /** Every Resource not already scored: one score per stakeholder is a
   * kind rule, so an entry that exists is not offered again. */
  const unscored = (resources?.options ?? []).filter(
    (r) => !entries.some((e) => e.resource === r.value),
  );
  const nameOf = (id: string) => resources?.names.get(id) ?? id;

  return (
    <div className="flex flex-col gap-3" data-slot="stakeholder-grid" data-cartograph-region="stakeholder-grid">
      <div className="flex items-center gap-1">
        <h3 className="text-sm font-medium">{pc.gridTitle}</h3>
        <Help label={pc.gridTitle} hint={pc.gridHint} />
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((e, idx) => (
          <div key={e.resource} data-cartograph-region={`stakeholder-${idx}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <span className="min-w-0 flex-1 truncate text-sm">{nameOf(e.resource)}</span>

            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={e.tier ?? ""}
              onValueChange={(v) => updateAt(idx, { tier: (v || undefined) as StakeholderTier })}
              aria-label={`${pc.tierLabel} ${nameOf(e.resource)}`}
              data-cartograph-field={`/spec/entries/${idx}/tier`}
            >
              {TIERS.map((t) => (
                <ToggleGroupItem key={t} value={t}>
                  {pc.tier[t]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
              {e.influence !== undefined && e.interest !== undefined
                ? `${e.influence}/${e.interest}`
                : pc.unplaced}
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
        ))}

        {unscored.length > 0 ? (
          <Select
            value=""
            onValueChange={(v) => v && setEntries([...entries, { resource: v }])}
          >
            <SelectTrigger className="w-64" aria-label={pc.addToGrid} data-cartograph-field="/spec/entries/-">
              <SelectValue placeholder={pc.addToGrid} />
            </SelectTrigger>
            <SelectContent>
              {unscored.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {entries.length > 0 ? <Grid entries={entries} nameOf={nameOf} onScore={updateAt} /> : null}
    </div>
  );
}

/** The nine cells. Picking a stakeholder first, then a cell, is how this
 * has always worked; the pick now names an entry on the map. */
function Grid({
  entries,
  nameOf,
  onScore,
}: {
  entries: StakeholderEntry[];
  nameOf: (id: string) => string;
  onScore: (idx: number, patch: Partial<StakeholderEntry>) => void;
}) {
  const unplaced = entries
    .map((e, idx) => ({ e, idx }))
    .filter(({ e }) => e.influence === undefined || e.interest === undefined);

  return (
    <div className="flex flex-col gap-2 2xl:max-w-80" data-cartograph-region="stakeholder-matrix">
      <div className="flex gap-2">
        <span className="flex items-center justify-center text-[10px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          {pc.influenceLabel}
        </span>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-3 gap-1">
            {GRID_ROWS.flatMap((influence) =>
              GRID_COLS.map((interest) => {
                const key = quadrantKey(influence, interest);
                const inCell = entries.filter(
                  (e) => e.influence === influence && e.interest === interest,
                );
                return (
                  <div
                    key={`${influence}-${interest}`}
                    data-slot="grid-cell"
                    data-influence={influence}
                    data-interest={interest}
                    aria-label={`${pc.influenceLabel} ${influence}, ${pc.interestLabel} ${interest}`}
                    className="flex h-16 flex-col items-start justify-between rounded-md border bg-card p-1.5 text-left text-[10px] leading-tight"
                  >
                    <span className="text-muted-foreground">{key ? pc.gridQuadrant[key] : ""}</span>
                    {inCell.length > 0 ? (
                      <span className="self-end text-sm font-medium tabular-nums">{inCell.length}</span>
                    ) : null}
                  </div>
                );
              }),
            )}
          </div>
          <p className="pt-1 text-center text-[10px] text-muted-foreground">{pc.interestLabel}</p>
        </div>
      </div>

      {unplaced.map(({ e, idx }) => (
        <div key={e.resource} data-cartograph-region={`stakeholder-place-${idx}`} className="flex flex-wrap items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {pc.placePrompt(nameOf(e.resource))}
          </span>
          {GRID_ROWS.flatMap((influence) =>
            GRID_COLS.map((interest) => (
              <Button
                key={`${influence}-${interest}`}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-1.5 text-[10px] tabular-nums"
                aria-label={`${nameOf(e.resource)}, ${pc.influenceLabel} ${influence}, ${pc.interestLabel} ${interest}`}
                onClick={() => onScore(idx, { influence, interest })}
              >
                {influence}/{interest}
              </Button>
            )),
          )}
        </div>
      ))}
    </div>
  );
}
