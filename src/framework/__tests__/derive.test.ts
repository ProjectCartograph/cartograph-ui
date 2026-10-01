import { describe, it, expect } from "vitest";

import {
  deriveProgrammeFramework,
  deriveProjectFramework,
  frameworkCSV,
  type FrameworkNames,
  type MeasureFacts,
} from "../derive";
import type { ProjectSpec } from "@/projects/types";
import type { ProgrammeSpec } from "@/programmes/types";

const measures: MeasureFacts[] = [
  {
    id: "quality-pass-rate",
    name: "Quality pass rate",
    resultLevel: "outcome",
    unit: "percent",
    source: "quality-check-tool",
    cycle: "seasonal-cycle",
    goals: ["faults-found-before-dispatch"],
    baseline: { value: 62, date: "2025-09" },
    target: { value: 80, date: "2026-06" },
  },
  {
    id: "member-season-earnings",
    name: "Member season earnings",
    resultLevel: "impact",
    unit: "dollars",
    source: "sales-ledger",
  },
];

const names: FrameworkNames = {
  goal: (id) => ({ "faults-found-before-dispatch": "Faults are found before dispatch" })[id] ?? id,
  source: (id) => ({ "quality-check-tool": "Quality check tool", "sales-ledger": "Sales ledger" })[id] ?? id,
  cycle: (id) => ({ "seasonal-cycle": "Seasonal cycle" })[id] ?? id,
  assumption: (id) => ({ "faults-can-be-reworked": "A fault found at intake can be put right" })[id] ?? id,
  role: (ref) => (ref?.external ? ref.external : (ref?.id ?? "")),
  measures,
};

const labels = {
  when: (w: string) => ({ atClosing: "At closing", atLanding: "Once in use" })[w] ?? w,
  deliverable: (id: string) => ({ "dv-training-pack": "Depot staff training pack" })[id] ?? id,
};

const project = {
  summary: { problems: [] },
  team: "quality-team",
  alignment: { goals: ["faults-found-before-dispatch"] },
  objectives: [
    {
      id: "objective-1",
      objective: "Catch faults at intake",
      keyResults: [
        {
          id: "kr",
          metric: "faults found at intake",
          direction: "increase",
          kind: "percent",
          target: { value: 85, date: "2026-06" },
          source: "quality-check-tool",
        },
      ],
    },
  ],
  kpis: [{ kpi: "quality-pass-rate", reason: "The standard is what it counts." }],
  deliverables: [
    {
      id: "dv-training-pack",
      name: "Depot staff training pack",
      acceptance: [{ by: { local: "resources", id: "delivery-lead" }, outcome: "signs off the pack" }],
    },
  ],
  successCriteria: [
    {
      id: "sc-intake",
      statement: "Faults are found at intake rather than by a buyer.",
      metric: "business",
      standard: "at least 85 percent",
      source: "quality-check-tool",
      cycle: "seasonal-cycle",
      from: [{ local: "deliverables", id: "dv-training-pack" }],
      assumes: ["faults-can-be-reworked"],
      confirmedBy: { local: "resources", id: "sponsor" },
      when: "atLanding",
    },
    {
      id: "sc-compliance",
      statement: "The data protection review is complete with no open actions.",
      metric: "compliance",
      confirmedBy: { external: "Cooperative Board" },
      when: "atClosing",
    },
  ],
} as unknown as ProjectSpec;

describe("a project's results framework", () => {
  const rows = deriveProjectFramework(project, names, labels);

  it("reads downwards, from the change sought to the work that gets there", () => {
    expect(rows.map((r) => r.level)).toEqual([
      "impact",
      "outcome",
      "outcome",
      "outcome",
      "output",
    ]);
  });

  // The measure names the goal, so it is that goal's indicator rather than
  // a row of its own: one measure in two places reads as two measures.
  it("hangs a measure on the goal it names", () => {
    const impact = rows.find((r) => r.level === "impact")!;
    expect(impact.result).toBe("Faults are found before dispatch");
    expect(impact.indicators).toEqual(["Quality pass rate (percent): 62 to 80 by 2026-06"]);
    expect(impact.verification).toEqual([
      { kind: "source", text: "Quality check tool" },
      { kind: "cycle", text: "Seasonal cycle" },
    ]);
    expect(rows.filter((r) => r.origin === "measure")).toHaveLength(0);
  });

  it("fills every column of a criterion that has one", () => {
    const row = rows.find((r) => r.result.startsWith("Faults are found at intake"))!;
    // The dimension is a mark in the table, so it is a field rather than
    // the first line of a list.
    expect(row.metric).toBe("business");
    expect(row.indicators).toEqual(["at least 85 percent"]);
    // Each line says which question it answers: a register, a cycle, a
    // role and a moment are not one list.
    expect(row.verification).toEqual([
      { kind: "source", text: "Quality check tool" },
      { kind: "cycle", text: "Seasonal cycle" },
      { kind: "confirmer", text: "sponsor" },
      { kind: "when", text: "Once in use" },
    ]);
    expect(row.assumptions).toEqual(["A fault found at intake can be put right"]);
    expect(row.from).toEqual(["Depot staff training pack"]);
  });

  // An empty column is an answer, not a gap: a compliance criterion has no
  // deliverable behind it and nothing here should invent one.
  it("leaves a criterion with nothing behind it empty", () => {
    const row = rows.find((r) => r.result.startsWith("The data protection review"))!;
    expect(row.from).toEqual([]);
    expect(row.assumptions).toEqual([]);
    expect(row.verification).toEqual([
      { kind: "confirmer", text: "Cooperative Board" },
      { kind: "when", text: "At closing" },
    ]);
  });

  it("reads an output's acceptance as its indicator", () => {
    const row = rows.find((r) => r.level === "output")!;
    expect(row.result).toBe("Depot staff training pack");
    expect(row.indicators).toEqual(["signs off the pack"]);
  });
});

describe("a measure no goal claims", () => {
  it("files under the level it declares for itself", () => {
    const spec = {
      summary: { problems: [] },
      team: "t",
      kpis: [{ kpi: "member-season-earnings", reason: "r" }],
    } as unknown as ProjectSpec;
    const rows = deriveProjectFramework(spec, names, labels);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ level: "impact", origin: "measure", result: "Member season earnings" });
  });
});

describe("a programme's results framework", () => {
  const programme = {
    aim: { change: "Produce meets one standard wherever it came from" },
    goals: ["faults-found-before-dispatch"],
    kpis: ["quality-pass-rate"],
    pathway: [
      {
        id: "step-one",
        outcome: "faults-found-before-dispatch",
        because: "A checker applying the standard the same way catches the fault at intake",
        assumes: ["faults-can-be-reworked"],
      },
    ],
  } as unknown as ProgrammeSpec;
  const rows = deriveProgrammeFramework(programme, names, [{ name: "Quality Check Rollout" }]);

  it("carries the reasoning a logframe has nowhere to write", () => {
    const step = rows.find((r) => r.origin === "pathway")!;
    expect(step.reason).toContain("catches the fault at intake");
    expect(step.assumptions).toEqual(["A fault found at intake can be put right"]);
    expect(step.indicators).toEqual(["Quality pass rate (percent): 62 to 80 by 2026-06"]);
  });

  // The pathway already ends on that goal. Listing it again would say the
  // programme is accountable for it twice.
  it("does not list a goal the pathway already reaches", () => {
    expect(rows.filter((r) => r.result === "Faults are found before dispatch")).toHaveLength(1);
  });

  it("reads the work inside it as the outputs", () => {
    expect(rows.filter((r) => r.level === "output").map((r) => r.result)).toEqual([
      "Quality Check Rollout",
    ]);
  });
});

describe("the export", () => {
  it("quotes every field and doubles a quote inside one", () => {
    const csv = frameworkCSV(
      [
        {
          level: "outcome",
          origin: "criterion",
          result: 'A "quoted" statement, with a comma',
          indicators: ["a", "b"],
          verification: [],
          assumptions: [],
          from: [],
        },
      ],
      ["Level", "Result", "Indicators", "Verification", "Assumptions", "Produced by"],
      { metric: (m) => m, verification: { source: "Read from" } },
    );
    expect(csv.split("\n")[1]).toBe('"outcome","A ""quoted"" statement, with a comma","a; b","","",""');
  });
});
