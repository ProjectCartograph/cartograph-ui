import type { ProjectSpec, StepPath } from "./types";

/**
 * What a project definition is made of, in the order the results chain
 * reads: the problem, the objective that answers it, what the work
 * produces, how anyone will know it worked, what it is measured by, and who
 * runs it afterwards (the logframe's rows, and the charter's sections).
 *
 * People asked to see what they are assembling while they assemble it
 * (LSS_REVIEW.md, D22). Read from the working draft, so a part lights the
 * moment it is written, not when it is saved.
 */
export const ASSEMBLY_PARTS = ["problem", "objective", "produces", "success", "measures", "handover"] as const;
export type AssemblyPart = (typeof ASSEMBLY_PARTS)[number];

export interface AssemblyState {
  part: AssemblyPart;
  /** How many of this part there are; 1 for a part that is single. */
  count: number;
  filled: boolean;
  /** In place through the project this is a component of, not written
   * here (TAXONOMY.md D15). */
  inherited?: boolean;
  /** The step that fills it. */
  path: StepPath;
}

export function assembly(spec: ProjectSpec): AssemblyState[] {
  const problems = (spec.summary?.problems ?? []).filter((p) => (p.problem?.situation ?? "").trim() !== "").length;
  const objective = (spec.objectives ?? []).some((o) => (o.objective ?? "").trim() !== "") ? 1 : 0;
  const produces = (spec.deliverables ?? []).filter((d) => (d.name ?? "").trim() !== "").length;
  const success = (spec.successCriteria ?? []).length;
  const measures = (spec.kpis ?? []).length;
  const handover = (spec.operation ?? "").trim() !== "" ? 1 : 0;
  const counts: Record<AssemblyPart, [number, StepPath]> = {
    problem: [problems, "/initiation/aim"],
    objective: [objective, "/initiation/measures"],
    produces: [produces, "/initiation/deliverables"],
    success: [success, "/initiation/success"],
    measures: [measures, "/initiation/measures"],
    handover: [handover, "/landing"],
  };
  // A component moves its parent's measures; the checks say the same.
  const isComponent = (spec.alignment?.partOf ?? "") !== "";
  return ASSEMBLY_PARTS.map((part) => {
    const inherited = isComponent && part === "measures" && counts[part][0] === 0;
    return {
      part,
      count: counts[part][0],
      filled: counts[part][0] > 0 || inherited,
      path: counts[part][1],
      ...(inherited ? { inherited } : {}),
    };
  });
}
