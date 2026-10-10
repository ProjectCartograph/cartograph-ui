// The triple constraint in a project's own words (engine TAXONOMY.md D60):
// which risks would move a side, and what each bears on. Pure, so the
// panels and the overview read risks the same way. The weights and the
// most constrained side are the engine's (GET /constraints); this only
// sorts what the draft already says, for the panels beside each section.

import type { Constraint, ImpactLikelihood, ProjectSpec, Risk, RiskAffects } from "../types";

/** A risk on one side, with its place in the list it came from. */
export interface RiskOnSide {
  index: number;
  risk: Risk;
  affects: RiskAffects;
}

/** The risks that would move side, optionally only those bearing on one
 * of items. */
export function risksOn(risks: readonly Risk[], side: Constraint, items?: readonly string[]): RiskOnSide[] {
  const out: RiskOnSide[] = [];
  risks.forEach((risk, index) => {
    const a = risk.affects?.find((x) => x.constraint === side);
    if (!a) return;
    if (items && a.on && !items.includes(a.on)) return;
    out.push({ index, risk, affects: a });
  });
  return out;
}

/** The risk with side placed (or replaced) by patch, keeping its other
 * sides. */
export function placeOn(risk: Risk, side: Constraint, patch: Partial<RiskAffects> = {}): Risk {
  const others = (risk.affects ?? []).filter((a) => a.constraint !== side);
  const current = risk.affects?.find((a) => a.constraint === side);
  return { ...risk, affects: [...others, { ...current, ...patch, constraint: side }] };
}

/** The risk taken off side. */
export function takeOff(risk: Risk, side: Constraint): Risk {
  const affects = (risk.affects ?? []).filter((a) => a.constraint !== side);
  const { affects: _dropped, ...rest } = risk;
  return affects.length > 0 ? { ...rest, affects } : rest;
}

/** A new risk placed on side, on an item, with its impact there. */
export function newRiskOn(id: string, description: string, side: Constraint, impact?: ImpactLikelihood, on?: string): Risk {
  const affects: RiskAffects = { constraint: side };
  if (impact) affects.impact = impact;
  if (on) affects.on = on;
  return { id, description, type: "risk", affects: [affects] };
}

/** What a risk on each side can bear on: the deliverables (scope), the
 * milestones (schedule) and the cost lines (cost). */
export function bearsOnOf(spec: ProjectSpec): Record<Constraint, { id: string; name: string }[]> {
  const named = <T extends { id?: string }>(list: readonly T[] | undefined, name: (t: T) => string) =>
    (list ?? []).filter((t) => t.id).map((t) => ({ id: t.id!, name: name(t) || t.id! }));
  return {
    scope: named(spec.deliverables, (d) => d.name),
    schedule: named(spec.milestones, (m) => m.name),
    cost: named(spec.costs, (c) => c.basis || c.category),
  };
}
