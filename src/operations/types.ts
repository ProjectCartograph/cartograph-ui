import { Compass, Gauge, Settings2 } from "lucide-react";

import type { DefinitionStep } from "@/definition/Shell";
import type { DataUse, Mandate } from "@/projects/types";

/** An operation: continuing work with no end date. It has no problems and
 * no goals of its own — it runs a service, and what that service is for is
 * carried by the programmes it belongs to and the KPIs it moves. */
export interface OperationSpec {
  name?: string;
  purpose?: string;
  /** Accountable for the service end to end (ITIL service owner): a role
   * from the Resource catalogue. `team` is the unit that runs it. */
  serviceOwner?: string;
  team?: string;
  programmes?: string[];
  serviceWindow?: string;
  kpis?: string[];
  data?: DataUse;
  mandate?: Mandate[];
  /** A note per step of the walk, keyed by the step's own name. */
  notes?: Record<string, string>;
}

export function blankOperationSpec(): OperationSpec {
  return {};
}

export const OPERATION_STEPS: DefinitionStep[] = [
  { section: "service", label: "Service", to: "/operations/$id/service", icon: Settings2 },
  { section: "alignment", label: "Alignment", to: "/operations/$id/alignment", icon: Compass },
  { section: "measures", label: "Service levels", to: "/operations/$id/measures", icon: Gauge },
];
