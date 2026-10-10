import { Link } from "@tanstack/react-router";
import { Lock, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy, plusNoun } from "@/copy";
import { useProjectStore } from "../store";
import type { Constraint, ImpactLikelihood } from "../types";
import { bearsOnOf, newRiskOn, risksOn } from "./triangle";
import { MiniTriangle } from "./Overview";

const tc = copy.projects.triangle;
const rc = copy.projects.risks;
const NONE = "__side__";

/** An item a risk can bear on: a deliverable, a milestone, a cost line. */
export interface BearsOn {
  id: string;
  name: string;
}

function suffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * The risks that would move one side of the triangle, shown beside the
 * section that holds it (engine TAXONOMY.md D60), with an add that places
 * the new risk here. A risk is declared once, in the register; this shows
 * it where it bears, and Open in Risks goes to the rest of it.
 */
export function RisksHere({ side, items = [] }: { side: Constraint; items?: readonly BearsOn[] }) {
  const store = useProjectStore();
  const risks = store.spec.risks ?? [];
  const here = risksOn(risks, side);
  const held = store.spec.constraints?.[side] === "hold";
  const nameOf = new Map(items.map((i) => [i.id, i.name]));
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState<ImpactLikelihood | "">("");
  const [on, setOn] = useState(NONE);
  const sideName = tc.sides[side];

  function add() {
    const text = description.trim();
    if (!text) return;
    const risk = newRiskOn(`r-${suffix()}`, text.slice(0, 160), side, impact || undefined, on === NONE ? undefined : on);
    store.updateSpec((s) => ({ ...s, risks: [...(s.risks ?? []), risk] }));
    setDescription("");
    setImpact("");
    setOn(NONE);
    setAdding(false);
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-dashed p-3" data-cartograph-region={`risks-here-${side}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          {tc.hereHeading(sideName)}
          {held ? (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground" title={tc.stanceTitle.hold}>
              <Lock className="size-3" aria-hidden />
              {tc.held}
            </span>
          ) : null}
        </h3>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link to="/projects/$id/initiation/risks" params={{ id: store.id }}>
            {tc.inRegister}
          </Link>
        </Button>
      </div>
      <MiniTriangle />
      {here.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tc.hereEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {here.map(({ index, risk, affects }) => (
            <li key={risk.id ?? index} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="text-pretty">{risk.description || rc.unnamed}</span>
              {affects.impact ? <span className="text-xs text-muted-foreground">{rc.levels[affects.impact]}</span> : null}
              {affects.on && nameOf.get(affects.on) ? (
                <span className="text-xs text-muted-foreground">{tc.on(nameOf.get(affects.on)!)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setAdding(false);
            }}
            aria-label={tc.hereDescription}
            maxLength={160}
            className="min-w-60 flex-1"
            data-cartograph-field="/spec/risks/-/description"
          />
          <Select value={impact} onValueChange={(v) => setImpact(v as ImpactLikelihood)}>
            <SelectTrigger className="w-32" aria-label={tc.hereImpact} data-cartograph-field="/spec/risks/-/affects/-/impact">
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
          {items.length > 0 ? (
            <Select value={on} onValueChange={setOn}>
              <SelectTrigger className="w-48" aria-label={tc.hereOn} data-cartograph-field="/spec/risks/-/affects/-/on">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{tc.hereOnNone}</SelectItem>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={add} disabled={!description.trim()}>
            {tc.hereSave}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
            {tc.hereCancel}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start border-dashed"
          onClick={() => setAdding(true)}
          title={tc.hereAdd(sideName)}
          aria-label={tc.hereAdd(sideName)}
        >
          <Plus />
          {plusNoun(tc.hereAddShort)}
        </Button>
      )}
    </section>
  );
}

/** The risks to one side, beside the section that holds it, with what
 * they can bear on read from the project. */
export function SideRisks({ side }: { side: Constraint }) {
  const store = useProjectStore();
  return <RisksHere side={side} items={bearsOnOf(store.spec)[side]} />;
}
