/**
 * Which kind of record the answers to New's questions make (TAXONOMY.md
 * D14, D15, D30), one yes-or-no at a time. Work that keeps running is a
 * service: one that runs today is recorded as it is, and a new one is
 * recorded as planned before the project that sets it up. Work that
 * finishes is first split by who is in charge: one person in charge of all
 * of it, with one budget, makes a project; several projects, each with its
 * own person in charge and budget, make a programme. A project is then
 * either a project of its own or one part (a component) of a bigger one.
 */
export type Ends = "finishes" | "runs";
/** For work that keeps running: whether it runs today. */
export type Today = "today" | "new";
/** For work that finishes: one person in charge with one budget, or not. */
export type InCharge = "one" | "many";
/** For a project: a project of its own, or a part of a bigger one. */
export type PartOf = "own" | "part";
export type NewKind = "project" | "component" | "programme" | "operation" | "service";

export function kindOf(ends: Ends | null, answer: Today | InCharge | null, partOf: PartOf | null = null): NewKind | null {
  if (!ends || !answer) return null;
  if (ends === "runs") {
    if (answer === "today") return "operation";
    if (answer === "new") return "service";
    return null;
  }
  if (answer === "many") return "programme";
  if (answer !== "one") return null;
  if (partOf === "own") return "project";
  if (partOf === "part") return "component";
  return null;
}
