import { Link } from "@tanstack/react-router";
import { Link2, Lock, Pencil, Plus, Unlink, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy, plusNoun } from "@/copy";
import { useProjectStore } from "../store";
import type { Constraint, ImpactLikelihood } from "../types";
import { bearsOnOf, newRiskOn, placeOn, risksOn, takeOff } from "./triangle";
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

  // One risk changed in place: its words, and how much it moves this side.
  const [editing, setEditing] = useState(-1);
  const [draft, setDraft] = useState("");
  const [draftImpact, setDraftImpact] = useState<ImpactLikelihood | "">("");
  function startEdit(index: number, description: string, impact?: ImpactLikelihood) {
    setEditing(index);
    setDraft(description);
    setDraftImpact(impact ?? "");
  }
  function save(index: number, was?: ImpactLikelihood) {
    const text = draft.trim();
    if (!text) return;
    store.updateSpec((s) => ({
      ...s,
      risks: (s.risks ?? []).map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, description: text };
        return draftImpact && draftImpact !== was ? placeOn(next, side, { impact: draftImpact }) : next;
      }),
    }));
    setEditing(-1);
  }
  // A risk on other sides too is taken off this one only: it is still
  // the same risk where else it bears.
  function unlink(index: number) {
    store.updateSpec((s) => ({ ...s, risks: (s.risks ?? []).map((r, i) => (i === index ? takeOff(r, side) : r)) }));
  }
  function remove(index: number) {
    store.updateSpec((s) => {
      const left = (s.risks ?? []).filter((_, i) => i !== index);
      return { ...s, risks: left.length > 0 ? left : undefined };
    });
  }

  // A risk already raised on another side, placed on this one too: one
  // risk that moves several sides is declared once (TAXONOMY.md D60), not
  // typed again for each.
  const elsewhere = risks
    .map((risk, index) => ({ risk, index }))
    .filter(({ risk }) => !risk.affects?.some((a) => a.constraint === side) && (risk.affects?.length ?? 0) > 0);
  const [linking, setLinking] = useState("");
  function link() {
    const index = Number(linking);
    if (linking === "" || Number.isNaN(index)) return;
    const patch = { ...(impact ? { impact } : {}), ...(on !== NONE ? { on } : {}) };
    store.updateSpec((s) => ({ ...s, risks: (s.risks ?? []).map((r, i) => (i === index ? placeOn(r, side, patch) : r)) }));
    setLinking("");
    setImpact("");
    setOn(NONE);
    setAdding(false);
  }

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
        {/* The stance beside the heading, not in it: the page's outline
            reads the heading alone. */}
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-medium">{tc.hereHeading(sideName)}</h3>
          {held ? (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground" title={tc.stanceTitle.hold}>
              <Lock className="size-3" aria-hidden />
              {tc.held}
            </span>
          ) : null}
        </div>
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
          {here.map(({ index, risk, affects }) =>
            editing === index ? (
              <li key={risk.id ?? index} className="flex flex-wrap items-center gap-2 text-sm" data-editing="">
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 160))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save(index, affects.impact);
                    if (e.key === "Escape") setEditing(-1);
                  }}
                  aria-label={tc.hereDescription}
                  maxLength={160}
                  className="min-w-60 flex-1"
                  data-cartograph-field={`/spec/risks/${index}/description`}
                />
                <Select value={draftImpact} onValueChange={(v) => setDraftImpact(v as ImpactLikelihood)}>
                  <SelectTrigger className="w-32" aria-label={`${tc.hereImpact}: ${sideName}`}>
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
                <Button type="button" size="sm" variant="outline" onClick={() => save(index, affects.impact)} disabled={!draft.trim()}>
                  {tc.hereSave}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(-1)}>
                  {tc.hereCancel}
                </Button>
              </li>
            ) : (
              <li key={risk.id ?? index} className="group flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-pretty">{risk.description || rc.unnamed}</span>
                {affects.impact ? <span className="text-xs text-muted-foreground">{rc.levels[affects.impact]}</span> : null}
                {affects.on && nameOf.get(affects.on) ? (
                  <span className="text-xs text-muted-foreground">{tc.on(nameOf.get(affects.on)!)}</span>
                ) : null}
                {(risk.affects?.length ?? 0) > 1 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-slot="also-on">
                    <Link2 className="size-3" aria-hidden />
                    {tc.alsoOn(otherSides(risk.affects ?? [], side))}
                  </span>
                ) : null}
                {/* What was raised here is changed or taken back here. */}
                <span className="ml-auto flex items-center gap-0.5 self-center">
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => startEdit(index, risk.description, affects.impact)} aria-label={tc.editRisk(risk.description || rc.unnamed)} title={tc.editRisk(risk.description || rc.unnamed)}>
                    <Pencil />
                  </Button>
                  {(risk.affects?.length ?? 0) > 1 ? (
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => unlink(index)} aria-label={tc.unlinkRisk(risk.description || rc.unnamed, sideName)} title={tc.unlinkRisk(risk.description || rc.unnamed, sideName)}>
                      <Unlink />
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => remove(index)} aria-label={tc.removeRisk(risk.description || rc.unnamed)} title={tc.removeRisk(risk.description || rc.unnamed)}>
                      <X />
                    </Button>
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      {adding ? (
        <div className="flex flex-wrap items-center gap-2">
          {elsewhere.length > 0 ? (
            <Select value={linking} onValueChange={setLinking}>
              <SelectTrigger className="w-full" aria-label={tc.linkLabel(sideName)} data-cartograph-region="link-risk">
                <SelectValue placeholder={tc.linkLabel(sideName)} />
              </SelectTrigger>
              <SelectContent>
                {elsewhere.map(({ risk, index }) => (
                  <SelectItem key={risk.id ?? index} value={String(index)} hint={tc.raisedOn(otherSides(risk.affects ?? [], side))}>
                    {risk.description || rc.unnamed}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {linking === "" ? (
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
          ) : null}
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
                <SelectItem value={NONE}>{tc.hereOnNone(sideName)}</SelectItem>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {linking === "" ? (
            <Button type="button" size="sm" variant="outline" onClick={add} disabled={!description.trim()}>
              {tc.hereSave}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={link}>
              <Link2 />
              {tc.linkShort}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setLinking("");
              setAdding(false);
            }}
          >
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

/** The other sides a risk bears on, in words. */
function otherSides(affects: readonly { constraint: string }[], side: Constraint): string {
  return affects
    .filter((a) => a.constraint !== side)
    .map((a) => tc.sides[a.constraint as Constraint].toLowerCase())
    .join(", ");
}

/** The risks to one side, beside the section that holds it, with what
 * they can bear on read from the project. */
export function SideRisks({ side }: { side: Constraint }) {
  const store = useProjectStore();
  return <RisksHere side={side} items={bearsOnOf(store.spec)[side]} />;
}
