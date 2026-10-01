import {
  Compass,
  Crosshair,
  MessageCircleWarning,
  Network,
  Scale,
  TriangleAlert,
  Users,
  Waypoints,
} from "lucide-react";

import type { DefinitionStep } from "@/definition/Shell";
import type { AimStatement } from "@/sentence";
import type { Mandate, ProblemLine, Risk } from "@/projects/types";

/** A programme: what it is for, what is wrong that it answers, what it
 * serves, and who runs it. Its problems are the same shape a project's
 * are, so they use the same editor and cite the same Gap register. */
/** One step of a programme's theory of change: the outcome reached, what
 * has to hold first, why those produce it, and what it assumes. */
export interface PathwayStep {
  id?: string;
  outcome?: string;
  from?: string[];
  because?: string;
  assumes?: string[];
}

export interface ProgrammeSpec {
  name?: string;
  aim?: AimStatement;
  source?: string;
  problems?: ProblemLine[];
  /** Accountable for the programme and its benefits (MSP senior
   * responsible owner): a role from the Resource catalogue. */
  sponsor?: string;
  manager?: string;
  businessChangeManager?: string;
  leadTeam?: string;
  supportingTeams?: string[];
  goals?: string[];
  kpis?: string[];
  risks?: Risk[];
  pathway?: PathwayStep[];
  mandate?: Mandate[];
  /** A note per step of the walk, keyed by the step's own name. */
  notes?: Record<string, string>;
}

export function blankProgrammeSpec(): ProgrammeSpec {
  return {};
}

/** Six steps, walked in this order. Aim first because everything else
 * is read against what the programme is for; problems before alignment
 * because a goal is chosen to answer something. */
export const PROGRAMME_STEPS: DefinitionStep[] = [
  { section: "aim", label: "Aim", to: "/programmes/$id/aim", icon: Crosshair },
  { section: "problems", label: "Problems", to: "/programmes/$id/problems", icon: MessageCircleWarning },
  { section: "alignment", label: "Alignment", to: "/programmes/$id/alignment", icon: Compass },
  // The theory sits straight after what it serves: alignment says which
  // goals, the pathway says how this programme believes they are reached.
  { section: "pathway", label: "Theory of change", to: "/programmes/$id/pathway", icon: Waypoints },
  { section: "risks", label: "Risks", to: "/programmes/$id/risks", icon: TriangleAlert },
  { section: "components", label: "Components", to: "/programmes/$id/components", icon: Network },
  { section: "stakeholders", label: "Stakeholders", to: "/programmes/$id/stakeholders", icon: Scale },
  { section: "teams", label: "Governance", to: "/programmes/$id/teams", icon: Users },
];
