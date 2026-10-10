import { CalendarClock, Coins, Package } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { copy } from "@/copy";
import { CONSTRAINTS, RESPONSES, type Constraint, type ImpactLikelihood, type Risk, type RiskResponse } from "../types";
import type { BearsOn } from "./RisksHere";
import { placeOn, takeOff } from "./triangle";

const tc = copy.projects.triangle;
const rc = copy.projects.risks;
const SIDE_ICON = { scope: Package, schedule: CalendarClock, cost: Coins } as const;
const NONE = "__none__";

/**
 * A risk's place on the triple constraint (engine TAXONOMY.md D60): each
 * side it would move as a tile, how far and what it bears on once
 * placed, then its response and the side that response spends.
 */
export function AffectsEditor({
  risk,
  index,
  items,
  onChange,
}: {
  risk: Risk;
  index: number;
  items: Partial<Record<Constraint, readonly BearsOn[]>>;
  onChange: (next: Risk) => void;
}) {
  const base = `/spec/risks/${risk.id ? `{${risk.id}}` : index}`;
  return (
    <div className="flex flex-col gap-2" data-cartograph-region="risk-affects">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{tc.affectsLabel}</span>
        {CONSTRAINTS.map((side) => {
          const Icon = SIDE_ICON[side];
          const on = risk.affects?.some((a) => a.constraint === side) ?? false;
          return (
            <Toggle
              key={side}
              size="sm"
              variant="outline"
              pressed={on}
              onPressedChange={(p) => onChange(p ? placeOn(risk, side) : takeOff(risk, side))}
              aria-label={on ? tc.affectsRemove(tc.sides[side]) : tc.affectsAdd(tc.sides[side])}
              title={on ? tc.affectsRemove(tc.sides[side]) : tc.affectsAdd(tc.sides[side])}
              data-cartograph-field={`${base}/affects`}
            >
              <Icon />
              {tc.sides[side]}
            </Toggle>
          );
        })}
      </div>
      {(risk.affects ?? []).map((a) => {
        const list = items[a.constraint] ?? [];
        const at = `${base}/affects/{${a.constraint}}`;
        return (
          <div key={a.constraint} className="flex flex-wrap items-center gap-2 pl-2 text-sm">
            <span className="w-20 text-muted-foreground">{tc.sides[a.constraint]}</span>
            <Select value={a.impact ?? ""} onValueChange={(v) => onChange(placeOn(risk, a.constraint, { impact: v as ImpactLikelihood }))}>
              <SelectTrigger className="w-28" aria-label={`${tc.hereImpact}: ${tc.sides[a.constraint]}`} data-cartograph-field={`${at}/impact`}>
                <SelectValue placeholder={tc.hereImpact} />
              </SelectTrigger>
              <SelectContent>
                {(["low", "medium", "high"] as const).map((l) => (
                  <SelectItem key={l} value={l}>
                    {rc.levels[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {list.length > 0 ? (
              <Select
                value={a.on ?? NONE}
                onValueChange={(v) => onChange(placeOn(risk, a.constraint, { on: v === NONE ? undefined : v }))}
              >
                <SelectTrigger className="w-48" aria-label={`${tc.hereOn}: ${tc.sides[a.constraint]}`} data-cartograph-field={`${at}/on`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{tc.hereOnNone}</SelectItem>
                  {list.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        );
      })}
      {risk.type !== "constraint" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Select value={risk.response ?? ""} onValueChange={(v) => onChange({ ...risk, response: v as RiskResponse })}>
            <SelectTrigger className="w-36" aria-label={tc.responseLabel} data-cartograph-field={`${base}/response`}>
              <SelectValue placeholder={tc.responseLabel} />
            </SelectTrigger>
            <SelectContent>
              {RESPONSES.map((r) => (
                <SelectItem key={r} value={r} title={tc.responseTitle[r]}>
                  {tc.responses[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={risk.spends ?? NONE}
            onValueChange={(v) => {
              const { spends: _old, ...rest } = risk;
              onChange(v === NONE ? rest : { ...rest, spends: v as Constraint });
            }}
          >
            <SelectTrigger className="w-44" aria-label={tc.spendsLabel} data-cartograph-field={`${base}/spends`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{tc.spendsNone}</SelectItem>
              {CONSTRAINTS.map((c) => (
                <SelectItem key={c} value={c}>
                  {`${tc.spendsLabel}: ${tc.sides[c]}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
