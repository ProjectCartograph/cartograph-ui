import type { components } from "@/api/gen/schema";

export type GoalNode = components["schemas"]["GoalNode"];
export type GoalTree = components["schemas"]["GoalTree"];
export type GoalAligned = components["schemas"]["GoalAligned"];

/** Falls back to this when /settings has not answered yet. Kept in one
 * place so it matches the server's own default (engine.defaultSettings). */
export function defaultGoalLevels(): string[] {
  return ["Pillar", "Strategic", "Functional"];
}
