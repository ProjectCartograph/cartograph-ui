import type { ProjectSpec, Ref, SuccessCriterion } from "@/projects/types";

import type { ProgrammeSpec } from "@/programmes/types";

/**
 * The results framework, derived.
 *
 * A logframe is a matrix of levels against four columns: what the result
 * is, how it is measured, where that measurement is read, and what the
 * step rests on. Every one of those already exists somewhere in the
 * manifests, so this holds nothing — it reads. That is the whole point: a
 * results framework kept as a second document drifts from the work the
 * first time somebody edits one and not the other, and an organisation
 * with a logframe in a spreadsheet has exactly that problem
 * (RESULTS_LOGIC.md R4).
 *
 * Nothing here decides whether a framework is complete. An empty column
 * is a real answer: a criterion assessing compliance has no deliverable
 * behind it, and a programme nobody has argued through yet has no
 * assumptions to show.
 */

export type ResultLevel = "impact" | "outcome" | "output";

export const RESULT_LEVELS: ResultLevel[] = ["impact", "outcome", "output"];

/** Which manifest field a row was read from, so the view can mark it
 * rather than infer it from how the text reads. */
export type RowOrigin =
  | "goal"
  | "objective"
  | "criterion"
  | "deliverable"
  | "measure"
  | "pathway"
  | "component";

/**
 * What a verification line is, as against what it says.
 *
 * "TTNLA diagnostic assessment, Academic year, Data Analyst, Chief
 * Education Officer, Every cycle after that" is five answers to four
 * different questions, and a flat list makes the reader sort them out
 * (Programme Lead, 2026-09-29). Each carries the question it answers, so
 * the table can mark it.
 */
export type VerificationKind = "source" | "cycle" | "owner" | "confirmer" | "when" | "role";

export interface Verification {
  kind: VerificationKind;
  text: string;
}

export interface FrameworkRow {
  level: ResultLevel;
  origin: RowOrigin;
  /** The result itself: a goal, an outcome, a thing delivered. */
  result: string;
  /** Why the step below produces this one, where the work says so. Only a
   * pathway carries it; a logframe has nowhere to write it down, which is
   * the gap a theory of change exists to fill. */
  reason?: string;
  /** Which dimension the result is judged on, where it has one. A mark
   * in the table rather than a word, since the seven dimensions already
   * have one (components/vocab.tsx). */
  metric?: string;
  /** How it is measured. */
  indicators: string[];
  /** Where the measurement is read, how often, who settles it and when,
   * each saying which of those it is. */
  verification: Verification[];
  /** What has to be true for this step to hold. */
  assumptions: string[];
  /** What produces it, where the work declared anything. */
  from: string[];
}

/** One measure, as much of it as a framework row needs. */
export interface MeasureFacts {
  id: string;
  name: string;
  resultLevel?: string;
  unit?: string;
  direction?: string;
  source?: string;
  cycle?: string;
  goals?: string[];
  baseline?: { value: number; date: string };
  target?: { value: number; date: string };
}

/** Everything the derivation needs that is not in the spec it is reading:
 * the names behind ids, and the measures behind their references. Each
 * falls back to the id, so a framework is still readable while a register
 * is still loading. */
export interface FrameworkNames {
  goal: (id: string) => string;
  source: (id: string) => string;
  cycle: (id: string) => string;
  assumption: (id: string) => string;
  /** A role reference, resolved against the manifest it lives in. */
  role: (ref: Ref | undefined) => string;
  measures: MeasureFacts[];
}

function clean(parts: (string | undefined | false)[]): string[] {
  const kept = parts.filter((p): p is string => typeof p === "string" && p.trim() !== "");
  // The same register named by two key results is one register on the
  // row, not two lines of the same words.
  return [...new Set(kept)];
}

/** A measure as one indicator line: what it counts, and the distance it
 * has to travel where both ends are known. */
export function measureIndicator(m: MeasureFacts): string {
  const unit = m.unit ? ` (${m.unit})` : "";
  if (m.baseline && m.target) {
    return `${m.name}${unit}: ${m.baseline.value} to ${m.target.value} by ${m.target.date}`;
  }
  if (m.target) return `${m.name}${unit}: ${m.target.value} by ${m.target.date}`;
  return `${m.name}${unit}`;
}

function measureVerification(m: MeasureFacts, names: FrameworkNames): Verification[] {
  return [
    ...verify("source", m.source && names.source(m.source)),
    ...verify("cycle", m.cycle && names.cycle(m.cycle)),
  ];
}

/** One verification line, or none where the work says nothing. */
function verify(kind: VerificationKind, text: string | undefined | false): Verification[] {
  return typeof text === "string" && text.trim() !== "" ? [{ kind, text: text.trim() }] : [];
}

/** The same line twice is one line: two key results read from the same
 * register named it twice on the same row. */
function uniqueVerification(items: Verification[]): Verification[] {
  const seen = new Set<string>();
  return items.filter((v) => {
    const key = `${v.kind}:${v.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function criterionRow(c: SuccessCriterion, names: FrameworkNames, whenLabel: (w: string) => string): FrameworkRow {
  return {
    level: "outcome",
    origin: "criterion",
    result: c.statement,
    metric: c.metric,
    indicators: clean([c.standard]),
    verification: [
      ...verify("source", c.source && names.source(c.source)),
      ...verify("cycle", c.cycle && names.cycle(c.cycle)),
      ...verify("owner", c.owner && names.role(c.owner)),
      ...verify("confirmer", names.role(c.confirmedBy)),
      ...verify("when", whenLabel(c.when)),
    ],
    assumptions: (c.assumes ?? []).map(names.assumption),
    from: (c.from ?? []).map((ref) => names.role(ref)),
  };
}

/**
 * A project's framework.
 *
 * The levels come from the work rather than from a column somebody filled
 * in: goals are the impact, criteria and objectives the outcomes,
 * deliverables the outputs. A measure files under the level it declares,
 * and attaches to the goal it names where it names one, so the same KPI
 * is not both a row and an indicator.
 */
export function deriveProjectFramework(
  spec: ProjectSpec,
  names: FrameworkNames,
  labels: { when: (w: string) => string; deliverable: (id: string) => string },
): FrameworkRow[] {
  const rows: FrameworkRow[] = [];
  const named = new Set((spec.kpis ?? []).map((k) => k.kpi));
  const measures = names.measures.filter((m) => named.has(m.id));
  const attached = new Set<string>();

  for (const id of spec.alignment?.goals ?? []) {
    const onThisGoal = measures.filter((m) => (m.goals ?? []).includes(id));
    onThisGoal.forEach((m) => attached.add(m.id));
    rows.push({
      level: "impact",
      origin: "goal",
      result: names.goal(id),
      indicators: onThisGoal.map(measureIndicator),
      verification: uniqueVerification(onThisGoal.flatMap((m) => measureVerification(m, names))),
      assumptions: [],
      from: [],
    });
  }

  for (const objective of spec.objectives ?? []) {
    rows.push({
      level: "outcome",
      origin: "objective",
      result: objective.objective,
      indicators: (objective.keyResults ?? []).map((kr) => {
        const unit = kr.unit ? ` (${kr.unit})` : "";
        const target = kr.target ? `: to ${kr.target.value} by ${kr.target.date}` : "";
        return `${kr.metric}${unit}${target}`;
      }),
      verification: uniqueVerification(
        (objective.keyResults ?? []).flatMap((kr) => verify("source", kr.source && names.source(kr.source))),
      ),
      assumptions: [],
      from: [],
    });
  }

  for (const c of spec.successCriteria ?? []) {
    rows.push(
      criterionRow(
        c,
        // A criterion's `from` names deliverables inside this project, so
        // it resolves against the project rather than against a register.
        { ...names, role: (ref) => (ref?.local === "deliverables" ? labels.deliverable(ref.id ?? "") : names.role(ref)) },
        labels.when,
      ),
    );
  }

  for (const d of spec.deliverables ?? []) {
    rows.push({
      level: "output",
      origin: "deliverable",
      result: d.name,
      indicators: (d.acceptance ?? []).map((a) => a.outcome),
      verification: uniqueVerification(
        (d.acceptance ?? []).flatMap((a) => verify("role", names.role(a.by))),
      ),
      assumptions: [],
      from: [],
    });
  }

  // A measure the project names but no goal above it does is still part of
  // the framework; it files under the level it declares for itself.
  for (const m of measures) {
    if (attached.has(m.id)) continue;
    rows.push({
      level: (m.resultLevel as ResultLevel) ?? "outcome",
      origin: "measure",
      result: m.name,
      indicators: [measureIndicator(m)],
      verification: measureVerification(m, names),
      assumptions: [],
      from: [],
    });
  }

  return sortByLevel(rows);
}

/**
 * A programme's framework, which is its pathway read as a matrix.
 *
 * The pathway already says what produces what and what that rests on, so
 * the middle of the table is written rather than inferred. Components are
 * the outputs: a programme delivers nothing itself, which is why the work
 * inside it is what fills that level.
 */
export function deriveProgrammeFramework(
  spec: ProgrammeSpec,
  names: FrameworkNames,
  components: { name: string }[],
): FrameworkRow[] {
  const rows: FrameworkRow[] = [];
  const measures = names.measures.filter((m) => (spec.kpis ?? []).includes(m.id));
  const onGoal = (id: string) => measures.filter((m) => (m.goals ?? []).includes(id));
  const inPathway = new Set((spec.pathway ?? []).map((s) => s.outcome).filter(Boolean) as string[]);

  // The aim's first part is the result; the parts are shown as written,
  // never joined into a sentence (TAXONOMY.md D19).
  const aim = (spec.aim?.change ?? "").trim() || (spec.aim?.gain ?? "").trim();
  if (aim) {
    rows.push({
      level: "impact",
      origin: "goal",
      result: aim,
      indicators: [],
      verification: [],
      assumptions: [],
      from: [],
    });
  }

  for (const id of spec.goals ?? []) {
    // A goal the pathway ends on is already a row; listing it twice says
    // the programme is accountable for it twice.
    if (inPathway.has(id)) continue;
    const ms = onGoal(id);
    rows.push({
      level: "impact",
      origin: "goal",
      result: names.goal(id),
      indicators: ms.map(measureIndicator),
      verification: uniqueVerification(ms.flatMap((m) => measureVerification(m, names))),
      assumptions: [],
      from: [],
    });
  }

  for (const step of spec.pathway ?? []) {
    if (!step.outcome) continue;
    const ms = onGoal(step.outcome);
    rows.push({
      level: "outcome",
      origin: "pathway",
      result: names.goal(step.outcome),
      reason: step.because,
      indicators: ms.map(measureIndicator),
      verification: uniqueVerification(ms.flatMap((m) => measureVerification(m, names))),
      assumptions: (step.assumes ?? []).map(names.assumption),
      from: (step.from ?? []).map(names.goal),
    });
  }

  for (const c of components) {
    rows.push({
      level: "output",
      origin: "component",
      result: c.name,
      indicators: [],
      verification: [],
      assumptions: [],
      from: [],
    });
  }

  return sortByLevel(rows);
}

/** Impact at the top, outputs at the bottom, and each level in the order
 * the manifest wrote it: a framework reads downwards from the change
 * sought to the work that gets there. */
function sortByLevel(rows: FrameworkRow[]): FrameworkRow[] {
  return RESULT_LEVELS.flatMap((level) => rows.filter((r) => r.level === level));
}

/** The matrix as comma-separated rows, for the export. Quotes are doubled
 * and every field is quoted, which is the one form every spreadsheet
 * reads the same way. */
export function frameworkCSV(
  rows: FrameworkRow[],
  header: string[],
  labels: { metric: (m: string) => string; verification: Record<string, string> },
): string {
  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.level,
        clean([r.result, r.reason]).join(" — "),
        clean([r.metric && labels.metric(r.metric), ...r.indicators]).join("; "),
        // A spreadsheet has no icons, so each line says which question it
        // answers rather than arriving as a name with no role.
        r.verification.map((v) => `${labels.verification[v.kind] ?? v.kind}: ${v.text}`).join("; "),
        r.assumptions.join("; "),
        r.from.join("; "),
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}
