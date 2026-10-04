import { Compass, Crosshair, Scale, Users } from "lucide-react";

import type { DefinitionStep } from "@/definition/Shell";

/** A portfolio: what it invests in, the strategy it is prioritised
 * against, and who governs it (engine TAXONOMY.md D32). What it holds is
 * read back from what names it, never written here. */
export interface PortfolioSpec {
  aim?: string;
  objectives?: string[];
  leadTeam?: string;
  funding?: string[];
  reviewCycle?: string;
  portfolios?: string[];
}

export function blankPortfolioSpec(): PortfolioSpec {
  return {};
}

export type Decision = "invest" | "hold" | "stop";
export type HeldKind = "Programme" | "Project" | "Portfolio";

/** One decision in the portfolio's decisions file. */
export interface DecisionLine {
  kind: HeldKind;
  id: string;
  priority?: number;
  decision: Decision;
  reason?: string;
  decidedOn?: string;
}

/** Four steps, in the order of the walk: its aim, the strategy it serves,
 * what it holds and decides on, and who governs it. */
export const PORTFOLIO_STEPS: DefinitionStep[] = [
  { section: "aim", label: "Aim", to: "/portfolios/$id/aim", icon: Crosshair },
  { section: "strategy", label: "Strategy", to: "/portfolios/$id/strategy", icon: Compass },
  { section: "holds", label: "Holds", to: "/portfolios/$id/holds", icon: Scale },
  { section: "governance", label: "Governance", to: "/portfolios/$id/governance", icon: Users },
];
