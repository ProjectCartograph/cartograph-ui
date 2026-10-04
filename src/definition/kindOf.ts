/**
 * Which kind of record the answers to New's questions make (TAXONOMY.md
 * D14, D15, D30). Work that keeps running is a service: one that runs
 * today is recorded as it is, and a new one is recorded as planned before
 * the project that sets it up. Work that finishes is told apart by who
 * answers for it: one accountable person and one budget make a project,
 * whose results framework covers all of it; a part under an existing
 * project's person and budget is a component of it; pieces that each need
 * their own are separate projects, run together as a programme.
 */
export type Ends = "finishes" | "runs";
/** For work that finishes: how it is organised. */
export type Size = "one" | "part" | "many";
/** For work that keeps running: whether it runs today. */
export type Today = "today" | "new";
export type NewKind = "project" | "component" | "programme" | "operation" | "service";

export function kindOf(ends: Ends | null, answer: Size | Today | null): NewKind | null {
  if (!ends || !answer) return null;
  if (ends === "runs") {
    if (answer === "today") return "operation";
    if (answer === "new") return "service";
    return null;
  }
  return ({ one: "project", part: "component", many: "programme" } as Record<string, NewKind>)[answer] ?? null;
}
