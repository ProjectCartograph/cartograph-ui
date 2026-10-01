import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Scale,
  CalendarRange,
  CircleCheck,
  Compass,
  Crosshair,
  Database,
  Gauge,
  Medal,
  Package,
  PlaneLanding,
  SlidersHorizontal,
  Sparkles,
  SquareDashed,
  TriangleAlert,
  Users,
} from "lucide-react";

import type { Stage } from "./types";

/**
 * A mark for every stage and every step. The rail and the stepper are the
 * two things on screen at all times, so they carry marks and one word
 * each rather than a phrase: the question itself is the heading of the
 * pane they sit beside, and does not need saying twice.
 */
export const STAGE_ICON: Record<Stage, LucideIcon> = {
  align: Compass,
  target: Crosshair,
  refine: SlidersHorizontal,
  polish: Sparkles,
};

export const STEP_ICON: Record<string, LucideIcon> = {
  goals: Compass,
  aim: Crosshair,
  beneficiaries: Users,
  scope: SquareDashed,
  measures: Gauge,
  deliverables: Package,
  success: Medal,
  closing: CircleCheck,
  resources: Briefcase,
  stakeholders: Scale,
  timeline: CalendarRange,
  data: Database,
  risks: TriangleAlert,
  landing: PlaneLanding,
};

export function stepIcon(section: string): LucideIcon | undefined {
  return STEP_ICON[section];
}
