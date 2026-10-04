/**
 * Which kind of record the answers to New's questions make (TAXONOMY.md
 * D14, D15, D30, D32), one yes-or-no at a time. Work that keeps running is
 * a service: one that runs today is recorded as it is, and a new one is
 * recorded as planned before the project that sets it up. Work that
 * finishes is first split by who is in charge. One person in charge of all
 * of it, with one budget, makes a project, either of its own or one part
 * (a component) of a bigger one. Otherwise it is several projects, told
 * apart by why they are together: each needs the others to bring about one
 * change (a programme); they are grouped to decide what to fund and in
 * what order (a portfolio); or neither, which is a collection, not a kind.
 */
export type Ends = "finishes" | "runs";
/** For work that keeps running: whether it runs today. */
export type Today = "today" | "new";
/** For work that finishes: one person in charge with one budget, or not. */
export type InCharge = "one" | "many";
/** For a project: a project of its own, or a part of a bigger one. */
export type PartOf = "own" | "part";
export type YesNo = "yes" | "no";
export type NewKind = "project" | "component" | "programme" | "portfolio" | "collection" | "operation" | "service";

export interface WorkAnswers {
  ends?: Ends | null;
  today?: Today | null;
  inCharge?: InCharge | null;
  partOf?: PartOf | null;
  /** Several projects: does each need the others for one change? */
  together?: YesNo | null;
  /** Several projects that do not: grouped to decide what to fund? */
  funds?: YesNo | null;
}

export function kindOf(a: WorkAnswers): NewKind | null {
  if (a.ends === "runs") {
    if (a.today === "today") return "operation";
    if (a.today === "new") return "service";
    return null;
  }
  if (a.ends !== "finishes") return null;
  if (a.inCharge === "one") {
    if (a.partOf === "own") return "project";
    if (a.partOf === "part") return "component";
    return null;
  }
  if (a.inCharge !== "many") return null;
  if (a.together === "yes") return "programme";
  if (a.together !== "no") return null;
  if (a.funds === "yes") return "portfolio";
  if (a.funds === "no") return "collection";
  return null;
}
