import { CircleAlert, Compass, Crosshair, Flag, Gauge, Map, MapPin, MapPinCheck, Network, ScrollText, Settings2, Tag, UserRound, Users, Waypoints } from "lucide-react";

import type { OutlinePart } from "@/components/OutlineStrip";
import { copy } from "@/copy";
import type { GapSpec } from "@/gaps/types";
import type { OperationSpec } from "@/operations/types";
import type { ProgrammeSpec } from "@/programmes/types";

const oc = copy.definition.outline;

/**
 * What a programme's and an operation's documents are made of, in the
 * order their charters read (LSS_REVIEW.md, D22): the same strip a project
 * shows, so every flow shows what is being built the same way.
 */
export function programmeOutline(spec: ProgrammeSpec, components: number): OutlinePart[] {
  const n = (x: unknown[] | undefined) => (x ?? []).length;
  return [
    { key: "aim", label: oc.aim, icon: Crosshair, count: spec.aim?.change?.trim() ? 1 : 0, to: "/programmes/$id/aim" },
    { key: "problems", label: oc.problems, icon: CircleAlert, count: n((spec.problems ?? []).filter((p) => p.problem?.situation?.trim())), to: "/programmes/$id/problems" },
    { key: "goals", label: oc.goals, icon: Compass, count: n(spec.goals), to: "/programmes/$id/alignment" },
    { key: "pathway", label: oc.pathway, icon: Waypoints, count: n(spec.pathway), to: "/programmes/$id/pathway" },
    { key: "components", label: oc.components, icon: Network, count: components, to: "/programmes/$id/components" },
    { key: "kpis", label: oc.kpis, icon: Gauge, count: n(spec.kpis), to: "/programmes/$id/alignment" },
    { key: "governance", label: oc.governance, icon: Users, count: spec.leadTeam ? 1 : 0, to: "/programmes/$id/teams" },
  ].map((p) => ({ ...p, filled: p.count > 0 }) as OutlinePart);
}

export function operationOutline(spec: OperationSpec): OutlinePart[] {
  const n = (x: unknown[] | undefined) => (x ?? []).length;
  return [
    { key: "service", label: oc.service, icon: Settings2, count: spec.purpose?.trim() ? 1 : 0, to: "/operations/$id/service" },
    { key: "owner", label: oc.owner, icon: UserRound, count: spec.team ? 1 : 0, to: "/operations/$id/service" },
    { key: "programmes", label: oc.programmes, icon: Compass, count: n(spec.programmes), to: "/operations/$id/alignment" },
    { key: "levels", label: oc.levels, icon: Gauge, count: n(spec.kpis), to: "/operations/$id/measures" },
  ].map((p) => ({ ...p, filled: p.count > 0 }) as OutlinePart);
}

/** A gap's outline: its name, the two states, what measures it, where it
 * was found, and the evidence. */
export function gapOutline(spec: GapSpec, name: string): OutlinePart[] {
  const has = (s: string | undefined) => (s?.trim() ? 1 : 0);
  return [
    { key: "name", label: oc.name, icon: Tag, count: has(name), to: "/gaps/$id/shortfall" },
    { key: "current", label: oc.current, icon: MapPin, count: has(spec.current), to: "/gaps/$id/shortfall" },
    { key: "desired", label: oc.desired, icon: MapPinCheck, count: has(spec.desired), to: "/gaps/$id/shortfall" },
    { key: "kpi", label: copy.gaps.measureLabel, icon: Gauge, count: has(spec.measure), to: "/gaps/$id/shortfall" },
    { key: "outcomes", label: oc.outcomes, icon: Flag, count: (spec.outcomes ?? []).length, to: "/gaps/$id/shortfall" },
    { key: "scope", label: oc.scope, icon: Map, count: (spec.segments ?? []).length, to: "/gaps/$id/scope" },
    { key: "evidence", label: oc.evidence, icon: ScrollText, count: has(spec.source) || has(spec.statement), to: "/gaps/$id/evidence" },
  ].map((p) => ({ ...p, filled: p.count > 0 }) as OutlinePart);
}
