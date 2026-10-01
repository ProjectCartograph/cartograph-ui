/**
 * Which kind of record the answers to "What are you describing?" make
 * (TAXONOMY.md D14). Work that keeps running is an operation, whatever else
 * is said about it; work that finishes is a project, a component of one,
 * or a programme, by whether one team with one sponsor and one budget can
 * deliver it.
 */
export type Ends = "finishes" | "runs";
export type Size = "one" | "part" | "many";
export type NewKind = "project" | "component" | "programme" | "operation";

export function kindOf(ends: Ends | null, size: Size | null): NewKind | null {
  if (ends === "runs") return "operation";
  if (ends !== "finishes" || !size) return null;
  return ({ one: "project", part: "component", many: "programme" } as const)[size];
}
