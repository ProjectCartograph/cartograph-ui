import type { LucideIcon } from "lucide-react";
import { CircleAlert, Gauge, Medal, Package, PlaneLanding, Target } from "lucide-react";

import { OutlineStrip } from "@/components/OutlineStrip";
import { copy } from "@/copy";
import { assembly, type AssemblyPart } from "./assembly";
import { useProjectStore } from "./store";

const ac = copy.projects.assembly;

const ICON: Record<AssemblyPart, LucideIcon> = {
  problem: CircleAlert,
  objective: Target,
  produces: Package,
  success: Medal,
  measures: Gauge,
  handover: PlaneLanding,
};

/** A project's outline: the results chain from the problem to handover. */
export function AssemblyStrip({ id }: { id: string }) {
  const store = useProjectStore();
  const parts = assembly(store.spec).map((p) => ({
    key: p.part,
    label: ac.parts[p.part],
    icon: ICON[p.part],
    filled: p.filled,
    inherited: p.inherited,
    count: p.count,
    to: `/projects/$id${p.path}` as const,
  }));
  return <OutlineStrip id={id} parts={parts} loaded={store.loaded} />;
}
