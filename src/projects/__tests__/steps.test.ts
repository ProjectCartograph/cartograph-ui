import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { copy } from "@/copy";
import { STAGES, STEPS, ALL_SECTIONS, FIRST_STEP, stepsOfStage } from "@/projects/types";
import { STAGE_ICON, stepIcon } from "@/projects/steps";

const routesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../routes/projects/$id");

describe("the four stages of a definition", () => {
  it("opens on Align, so a project starts from what it is part of", () => {
    expect(FIRST_STEP.stage).toBe("align");
    expect(FIRST_STEP.path).toBe("/initiation/goals");
  });

  it("puts every step in exactly one stage, and every stage has steps", () => {
    const counted = STAGES.flatMap((stage) => stepsOfStage(stage));
    expect(counted).toHaveLength(STEPS.length);
    for (const stage of STAGES) expect(stepsOfStage(stage).length).toBeGreaterThan(0);
  });

  it("walks Back and Next in the same order the steps are declared", () => {
    expect(ALL_SECTIONS.map((s) => s.section)).toEqual(STEPS.map((s) => s.section));
  });

  it("names and marks every stage", () => {
    for (const stage of STAGES) {
      expect(copy.projects.stages[stage]).toBeTruthy();
      expect(copy.projects.stageQuestion[stage]).toBeTruthy();
      expect(STAGE_ICON[stage]).toBeTruthy();
    }
  });

  // A step with no mark falls back to a bare word in the rail, and a step
  // with no route is a dead link discovered only in a browser.
  it.each(STEPS)("$section has a name, a mark and a route", (step) => {
    expect(copy.projects.sections[step.section]).toBeTruthy();
    expect(stepIcon(step.section)).toBeTruthy();
    const file = step.path.startsWith("/initiation/")
      ? path.join(routesDir, "initiation", `${step.section}.tsx`)
      : path.join(routesDir, `${step.section}.tsx`);
    expect(existsSync(file), `no route file for ${step.section} at ${file}`).toBe(true);
  });
});
