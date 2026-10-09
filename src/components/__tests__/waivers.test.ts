import { describe, expect, it } from "vitest";

import { byReason } from "../waivers";

describe("checks left for the person", () => {
  it("are read once per missing fact, with every check it holds open", () => {
    const target = "The board sets the target after the baseline.";
    const facts = byReason([
      { on: "KPI/lots-graded", check: "kpi-target", message: "No dated target yet.", reason: target },
      { on: "Purpose/default", check: "purpose-vision", message: "No vision yet.", reason: "Only the board states the vision." },
      { on: "Goal/graded-fruit", check: "smart-measurable", message: "Measurable: add a measure.", reason: target },
      { on: "Goal/graded-fruit", check: "smart-time-bound", message: "Time-bound: date the target.", reason: ` ${target}` },
    ]);
    expect(facts.map((f) => f.reason)).toEqual([target, "Only the board states the vision."]);
    expect(facts[0].checks.map((c) => `${c.on} ${c.check}`)).toEqual([
      "KPI/lots-graded kpi-target",
      "Goal/graded-fruit smart-measurable",
      "Goal/graded-fruit smart-time-bound",
    ]);
  });

  it("list a check two facts hold open under each", () => {
    const facts = byReason([
      { on: "Goal/g", check: "smart-time-bound", message: "Time-bound.", reason: "The first target waits. Also: The second target waits." },
      { on: "KPI/k2", check: "kpi-target", message: "No target.", reason: "The second target waits." },
    ]);
    expect(facts.map((f) => [f.reason, f.checks.length])).toEqual([
      ["The first target waits.", 1],
      ["The second target waits.", 2],
    ]);
  });

  it("carry what the person was asked about each fact", () => {
    const asked = "Asked the 2026 target; it is set at the board's December meeting";
    const facts = byReason([
      { on: "KPI/k", check: "kpi-target", message: "No target.", reason: "Set in December.", asked },
      { on: "Goal/g", check: "smart-measurable", message: "Measurable.", reason: "Set in December." },
      { on: "Project/p", check: "resources-funding", message: "No funding.", reason: "Budget to be confirmed.", asked: "not available" },
    ]);
    expect(facts.map((f) => f.asked)).toEqual([asked, "not available"]);
  });
});
