import { describe, it, expect } from "vitest";

import flow from "../../../contract/flows/project.flow.json";
import { copy } from "@/copy";
import { STAGES, stepsOfStage } from "../types";

// The walk is the contract's: the same stages, holding the same steps, in
// the same order (engine TAXONOMY.md D33). A stage added or a step moved in
// the engine fails here until the interface follows.
describe("the project walk", () => {
  it("has the contract's stages and steps, in order", () => {
    const contract = (flow as { spec: { stages: { key: string; steps: string[] }[] } }).spec.stages;
    expect([...STAGES]).toEqual(contract.map((s) => s.key));
    for (const stage of contract) {
      expect(stepsOfStage(stage.key as (typeof STAGES)[number]).map((s) => s.section)).toEqual(stage.steps);
    }
  });

  it("names and explains every stage", () => {
    for (const stage of STAGES) {
      expect(copy.projects.stages[stage]).toBeTruthy();
      expect(copy.projects.stageQuestion[stage]).toBeTruthy();
    }
  });
});
