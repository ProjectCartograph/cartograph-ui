import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";

import {
  deriveProgrammeFramework,
  deriveProjectFramework,
  type FrameworkNames,
  type MeasureFacts,
} from "../derive";

/**
 * The framework is generated or it is nothing.
 *
 * A logframe bolted on is a second document somebody keeps in step by
 * hand. This reads the shipped example — a definition taken all the way
 * through both flows — and asserts the matrix comes out complete from the
 * manifests alone. If a column can only be filled by hand, the fault is
 * in the flow that should have asked for it, and this is where that
 * shows.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== ".cartograph") walk(p, out);
    } else if (entry.endsWith(".yaml")) out.push(p);
  }
  return out;
}

function read(vault: string): Doc[] {
  return walk(vault)
    .flatMap((f) => parseAllDocuments(readFileSync(f, "utf8")).map((d) => d.toJS()))
    .filter((d) => d && typeof d === "object" && d.kind !== "Vault");
}

const docs: Doc[] = read("./examples/minimal");

const of = (kind: string) => docs.filter((d) => d.kind === kind);
const measures: MeasureFacts[] = of("KPI").map((d) => ({
  ...d.spec,
  id: d.metadata.id,
  name: d.spec?.name ?? d.metadata.name,
}));
const nameOf = (kind: string, id: string) =>
  of(kind).find((d) => d.metadata.id === id)?.metadata.name ?? id;

const names: FrameworkNames = {
  goal: (id) => nameOf("Goal", id),
  source: (id) => nameOf("DataSource", id),
  cycle: (id) => nameOf("ReportingCycle", id),
  assumption: (id) => of("Assumption").find((d) => d.metadata.id === id)?.spec?.statement ?? id,
  role: (ref) => ref?.external ?? ref?.id ?? "",
  measures,
};

describe("a project taken through the flow yields a whole framework", () => {
  const project = of("Project")[0];
  const rows = deriveProjectFramework(project.spec, names, {
    when: (w) => w,
    deliverable: (id) =>
      project.spec.deliverables?.find((d: Doc) => d.id === id)?.name ?? id,
  });

  it("fills every level", () => {
    expect(new Set(rows.map((r) => r.level))).toEqual(new Set(["impact", "outcome", "output"]));
  });

  // Each column has to be reachable from the flow. One row filling it is
  // enough: an empty cell elsewhere is the work saying nothing, which is
  // a different thing from the flow never asking.
  it("fills every column from the manifests alone", () => {
    for (const column of ["indicators", "verification", "assumptions", "from"] as const) {
      expect(rows.some((r) => r[column].length > 0), `nothing fills ${column}`).toBe(true);
    }
  });

  // The Level column is read off KPI.spec.resultLevel and the indicator
  // rows off KPI.spec.goals. Both were uneditable until 2026-09-29, which
  // is exactly the kind of hole this test exists to keep shut.
  it("reads its impact indicators off a measure that names the goal", () => {
    const impact = rows.filter((r) => r.level === "impact");
    expect(impact.length).toBeGreaterThan(0);
    expect(impact.some((r) => r.indicators.length > 0)).toBe(true);
    expect(impact.some((r) => r.verification.length > 0)).toBe(true);
  });

  it("settles every criterion somewhere, whether or not an output produces it", () => {
    const criteria = rows.filter((r) => r.origin === "criterion");
    expect(criteria.length).toBe(project.spec.successCriteria.length);
    expect(criteria.every((r) => r.verification.length > 0)).toBe(true);
  });
});

describe("a programme with a pathway yields a whole framework", () => {
  const programme = of("Programme").find((p) => (p.spec.pathway ?? []).length > 0)!;
  const inside = docs
    .filter(
      (d) =>
        (d.kind === "Project" || d.kind === "Operation") &&
        (d.spec?.alignment?.programmes ?? d.spec?.programmes ?? []).includes(programme.metadata.id),
    )
    .map((d) => ({ name: d.metadata.name }));
  const rows = deriveProgrammeFramework(programme.spec, names, inside);

  it("fills every level", () => {
    expect(new Set(rows.map((r) => r.level))).toEqual(new Set(["impact", "outcome", "output"]));
  });

  it("carries the reasoning and the assumptions off the pathway", () => {
    const steps = rows.filter((r) => r.origin === "pathway");
    expect(steps.length).toBe(programme.spec.pathway.length);
    expect(steps.every((r) => (r.reason ?? "").length > 0)).toBe(true);
    expect(steps.some((r) => r.assumptions.length > 0)).toBe(true);
    expect(steps.some((r) => r.from.length > 0)).toBe(true);
  });

  it("reads the work inside it as its outputs", () => {
    expect(rows.filter((r) => r.level === "output").length).toBe(inside.length);
    expect(inside.length).toBeGreaterThan(0);
  });
});
