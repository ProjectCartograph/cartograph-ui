// The Project manifest's spec shape, mirroring contract/schemas/project.schema.json
// and contract/schemas/rolebinding.schema.json. The generated OpenAPI types don't
// cover this (Manifest.spec is generically "an object"; runtime validation always
// uses the JSON Schema files directly), so this is hand-written and kept in step
// with the schema by hand, the same way the Goal surface's own types.ts already
// does.

import type { ChangeStatement, ProblemStatement } from "@/sentence";
import type { KeyResult } from "@/surfaces/goals/types";

export type { KeyResult } from "@/surfaces/goals/types";

export interface Mandate {
  title: string;
  kind: "decision" | "policy" | "lawOrRegulation" | "contract" | "businessCase" | "request";
  reference?: string;
  date?: string;
  /** Who issued it, as written: only for an issuer outside the
   * workspace, such as a government or a regulator. */
  issuedBy?: string;
  /** Who issued it, by reference: a governance body or a role the
   * workspace holds (TAXONOMY.md D43). Not both. */
  issuer?: Ref;
}

export interface FundingLine {
  amount: number;
  currency: string;
  /** The FundingSource this draws on. Optional: an amount nobody has found
   * a budget for yet is a real state, and a project should be able to say
   * so rather than invent one. */
  source?: string;
  status: "approved" | "requested" | "unfunded";
}

/** Who the project is for. Qualitative by design (Programme Lead,
 * 2026-09-26): a line identifies a group, and nothing counts it. */
export interface BeneficiaryLine {
  group: string;
}

/** One problem this project answers, the change that answers it, and the
 * beneficiary groups that feel it. A project may answer several, and the
 * same change may land differently on different groups (Programme Lead,
 * 2026-09-27). */
/** A link to something else, in the one shape Cartograph uses everywhere it
 * points at anything. Exactly one of three forms is filled in: a manifest
 * in the vault, an item inside this manifest, or a target Cartograph will never
 * hold. One shape means one picker edits them all, and one walk compiles
 * every edge in the vault into a dependency tree.
 *
 * It replaced three fields that stored a copy of a role's title on
 * 2026-09-28. A copy of a name goes stale the moment the name changes, and
 * nothing notices; a reference cannot. */
export type Ref =
  | { kind: RefKind; id: string; local?: never; external?: never }
  | { local: LocalRefList; id: string; kind?: never; external?: never }
  | { external: string; kind?: never; local?: never; id?: never };

/** The manifest kinds a reference can name. */
export type RefKind =
  | "Project" | "Programme" | "Operation" | "Goal" | "KPI"
  | "DataSource" | "Resource" | "Team" | "BeneficiaryGroup" | "ReportingCycle";

/** The lists inside a manifest a reference can name. */
export type LocalRefList =
  | "resources" | "stakeholders" | "objectives" | "deliverables" | "successCriteria"
  | "risks" | "problems" | "phases" | "milestones" | "conditions" | "signOffs";

/** Whether a reference names anything at all. */
export function refIsSet(ref: Ref | undefined): ref is Ref {
  if (!ref) return false;
  return Boolean(ref.external ?? ref.id);
}

/** A reference as the text to show. A local one resolves against the
 * project it lives in, which is the only place its target exists; the
 * other two show what they name, since resolving a manifest's name needs a
 * fetch the caller may not have. */
export function refLabel(ref: Ref | undefined, resolve?: (ref: Ref) => string | undefined): string {
  if (!ref) return "";
  if (ref.external) return ref.external;
  return resolve?.(ref) ?? ref.id ?? "";
}

/** A citation of one gap, and how much of it this work addresses. Absent
 * segments means the whole gap, which is what every citation written before
 * 2026-09-29 means. */
export interface GapCitation {
  gap: string;
  segments?: string[];
}

export interface ProblemLine {
  id?: string;
  /** Held in parts, and composed for reading: the sentence is an output,
   * not an input (`@/sentence`). */
  problem: ProblemStatement;
  change: ChangeStatement;
  groups?: string[];
  /** The evidenced findings this problem addresses, by id. A citation
   * rather than a restatement: a gap is what is wrong and how we know,
   * written once in the register; the problem says what that does to a
   * named group, on this piece of work. */
  gaps?: GapCitation[];
}

export interface ProjectSummary {
  /** What the project is about, in one sentence: the first thing asked,
   * and what suggestions are ranked against (engine docs/adr/0023). */
  about?: string;
  /** The idea as first written, kept as it was (TAXONOMY.md D34). */
  idea?: string;
  problems: ProblemLine[];
  scopeIn?: string[];
  scopeOut?: string[];
  beneficiaries?: BeneficiaryLine[];
}

export interface ProjectObjective {
  id?: string;
  objective: string;
  keyResults?: KeyResult[];
}

/** One thing that has to be true, and the role that says so. A deliverable
 * signed off by two roles carries two of these; a criterion with no role
 * named yet is legal and the checks say so. */
export interface AcceptanceCriterion {
  by?: Ref;
  outcome: string;
}

/** Work that produces part of a deliverable: a name, and the role that
 * does it where one is known. No order and no dates; those are the
 * planning tool's (TAXONOMY.md D38). */
export interface Task {
  id: string;
  name: string;
  role?: Ref;
  note?: string;
}

/** Something that happens (engine TAXONOMY.md D47). */
export interface PlanEvent {
  on: Ref;
  /** With on naming another project: the item in it, a milestone first. */
  item?: string;
  happens?: "reached" | "accepted" | "met" | "firstReading" | "issued" | "decided" | "approved" | "closed" | "landed" | "occurred";
}

/** When something falls, in one of four forms (engine TAXONOMY.md D47). */
export interface Timing {
  form: "date" | "window" | "after" | "when";
  date?: string;
  notBefore?: string;
  notAfter?: string;
  event?: PlanEvent;
  lagMonths?: number;
  lagDays?: number;
  expectedBy?: string;
  decidedBy?: Ref;
  risks?: string[];
  note?: string;
}

export interface Milestone {
  id: string;
  name: string;
  timing: Timing;
  owner?: Ref;
  waitsOn?: PlanEvent[];
  deliverables?: string[];
  evidence?: string;
}

export interface Responsibility {
  id: string;
  item: string;
  deliverable?: string;
  decision?: boolean;
  responsible?: Ref[];
  accountable?: Ref;
  consulted?: Ref[];
  informed?: Ref[];
}

export interface CostLine {
  id: string;
  category: string;
  basis?: string;
  amount?: number;
  currency?: string;
  period?: string;
  source?: string;
  status?: "approved" | "requested" | "beingCosted" | "unfunded";
  recurrent?: string;
  condition?: string;
}

export interface ProcurementItem {
  id: string;
  requirement: string;
  value?: number;
  currency?: string;
  valueNote?: string;
  method?: string;
  leadTime?: string;
  requiredBy?: Timing;
  owner?: Ref;
}

export interface Condition {
  id: string;
  action: string;
  owner?: Ref;
  due?: Timing;
  gates?: PlanEvent;
}

export interface SignOff {
  id: string;
  stage: "definition" | "closing" | "handover";
  label?: string;
  role: Ref;
}

/** What happened (engine TAXONOMY.md D52). */
export interface ProjectEvent {
  id: string;
  on: Ref;
  happened: "reached" | "slipped" | "accepted" | "rejected" | "met" | "notMet" | "occurred" | "issued" | "decided" | "signed";
  date: string;
  note?: string;
  evidence?: string;
  value?: number;
  decision?: "approve" | "approveWithConditions" | "reject";
  recordedBy?: string;
}

export interface Deliverable {
  id: string;
  name: string;
  description?: string;
  owner?: Ref;
  due?: Timing;
  evidence?: string;
  acceptance?: AcceptanceCriterion[];
  tasks?: Task[];
}

/** Which dimension of success a criterion measures. Six metric types
 * from the success-metrics model, plus compliance: the one kind that is
 * satisfied rather than measured, and so carries no standard, source or
 * cycle (Programme Lead, 2026-09-27). */
export type SuccessMetric =
  | "efficiency"
  | "customer"
  | "team"
  | "business"
  | "future"
  | "compliance";

export const SUCCESS_METRICS: SuccessMetric[] = [
  "efficiency",
  "customer",
  "team",
  "business",
  "future",
  "compliance",
];

export type SuccessCriterionWhen = "atClosing" | "atLanding" | "postClosingCycle";

/**
 * What has to be true for the project to have succeeded, not merely to
 * have finished. Five parts: the outcome, the metric and the standard
 * that settles it, where that measurement is read from and how often,
 * the role that tracks it and the role that confirms it.
 *
 * Two of those reuse registers Cartograph already keeps: the method of
 * measurement is a DataSource, the frequency is a ReportingCycle. A
 * criterion is the floor the project must clear; a key result is the
 * stretch it reaches for, which is why neither is derived from the other.
 */
export interface SuccessCriterion {
  id: string;
  statement: string;
  metric: SuccessMetric;
  /** The target, threshold or acceptable standard to be cleared. */
  standard?: string;
  /** Where the measurement is read from. */
  source?: string;
  /** How often it is read. */
  cycle?: string;
  /** The deliverables that produce this outcome, where any do. Optional
   * and never a completeness test: a criterion may equally assess
   * schedule, budget, compliance or any dimension no deliverable
   * produces. */
  from?: Ref[];
  /** What has to be true for those outputs to produce this outcome. */
  assumes?: string[];
  /** The role that tracks it. */
  owner?: Ref;
  /** The role or governance body that confirms success. A body Cartograph does
   * not hold takes the external form. */
  confirmedBy: Ref;
  when: SuccessCriterionWhen;
}

export type Handoff = "apiOrFeed" | "fileTransfer" | "sharedDatabase" | "manualReentry" | "paper";
/** What a project puts into the world, which decides what its sink has to
 * be: a register it stands up itself, rows in something that already
 * exists, files that land in a store, or a periodic extract. */
export type DataOutput =
  | "newDataSource"
  | "recordsInExistingSource"
  | "documentsOrFiles"
  | "extractOrReport";
export type PersonalData = "none" | "personal" | "sensitive";
export type Refresh = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "irregular";

export interface DataConsumeItem {
  source: string;
  purpose: string;
  handoff?: Handoff;
  personalData?: PersonalData;
}

export interface DataProduceItem {
  output: DataOutput;
  /** Where the produced data lands: the register, system or store that
   * holds it afterwards. */
  sink: string;
  purpose: string;
  refresh?: Refresh;
  personalData: PersonalData;
}

export interface DataUse {
  consumes?: DataConsumeItem[];
  produces?: DataProduceItem[];
}

export type RiskType = "risk" | "issue" | "dependency" | "constraint";
export type ImpactLikelihood = "low" | "medium" | "high";

export interface RiskEscalate {
  flag: boolean;
  reason?: string;
  /** Whose decision is needed: the sponsor, a board. */
  to?: Ref;
}

/** Which way a dependency runs. Declared at one end only: if this project
 * says it needs something, the far end shows "waiting on you" without
 * having to write the other half. */
export type DependencyDirection = "needs" | "neededBy";

/** The edge a dependency carries, and the reason the type is worth having:
 * a shape a risk sentence cannot be poured into. Every dependency in both
 * vaults was a misfiled risk, issue or constraint until this existed. */
export interface DependencyEdge {
  direction: DependencyDirection;
  on: Ref;
  /** The id of the phase in this project's timeline it must land by. */
  needBy?: string;
}

export interface Risk {
  id?: string;
  description: string;
  type: RiskType;
  /** Only on a dependency; a kind rule refuses it on any other type. */
  depends?: DependencyEdge;
  impact?: ImpactLikelihood;
  likelihood?: ImpactLikelihood;
  /** How likely it is to be caught in time (FMEA, engine TAXONOMY.md D58). */
  detection?: ImpactLikelihood;
  mitigation?: string;
  /** The role that manages it day to day (TAXONOMY.md D41); unowned, the
   * manager answers for it. Not who it escalates to. */
  owner?: Ref;
  escalate?: RiskEscalate;
}

/**
 * Retyping a row takes its edge with it.
 *
 * Only a dependency may carry one, and a kind rule refuses the manifest
 * otherwise, so a row switched to risk while still holding an edge would
 * fail its own validation on the next save. A named rule rather than a
 * line inside a handler, because it is a rule.
 */
export function retypeRisk(risk: Risk, type: RiskType): Risk {
  if (type === "dependency") return { ...risk, type };
  const { depends: _dropped, ...rest } = risk;
  return { ...rest, type };
}

export type ComplianceStatus = "notStarted" | "inProgress" | "met" | "notApplicable";

export interface ComplianceItem {
  item: string;
  status?: ComplianceStatus;
}

export interface TimelinePhase {
  id?: string;
  name: string;
  months: number;
}

export interface Timeline {
  start: string;
  phases: TimelinePhase[];
}

/** "yyyy-mm" as a plain month count since year 0, for arithmetic; shared by
 * TimelineSection's own shared-axis positioning and this file's
 * deriveTimelineEnd, so the two never drift. */
export function timelineMonthIndex(yearMonth: string): number | undefined {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return undefined;
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
}

export function addTimelineMonths(yearMonth: string, months: number): string {
  const idx = timelineMonthIndex(yearMonth);
  if (idx === undefined) return "";
  const total = idx + months;
  const outYear = Math.floor(total / 12);
  const outMonth = (total % 12) + 1;
  return `${outYear}-${String(outMonth).padStart(2, "0")}`;
}

/** The end date every phase's duration derives (rule 5, Timeline: "the
 * bars, the end date and the total follow from the start month"), or
 * undefined when there is no start or no phase yet. */
export function deriveTimelineEnd(timeline: Timeline | undefined): string | undefined {
  const phases = timeline?.phases ?? [];
  if (!timeline?.start || phases.length === 0) return undefined;
  let cursor = timeline.start;
  for (const p of phases) cursor = addTimelineMonths(cursor, p.months);
  return cursor || undefined;
}

export interface ProjectAlignment {
  goals?: string[];
  /** The programmes this project is part of. A project can span more than
   * one, and each one it names must share a goal with it: membership is
   * proven, not asserted (Programme Lead, 2026-09-27). */
  programmes?: string[];
  /** The project this one is a component of (TAXONOMY.md D15). A
   * component serves its parent's goals and belongs to its programmes, so
   * it names neither. */
  partOf?: string;
  /** The portfolios that select and fund this project (engine TAXONOMY.md
   * D32), independent of its programmes. */
  portfolios?: string[];
}

// The People and resources section's own role vocabulary
// (project.schema.json#/properties/spec/properties/resources). I3.2:
// definitions name roles, never persons; RoleBinding (an optional later
// mapping of one of these roles to a declared person) is no longer created
// or read by the interface at all (the delta on top of the goals-as-root
// card). Positions only since 2026-09-27: accountable, responsible,
// consulted and informed are RACI, which says how somebody relates to a
// task rather than what role they hold, and tasks live in the delivery
// tool.
// The standard project organisation roles since 2026-09-30 (TAXONOMY.md
// D23): PRINCE2, PMI, DAMA-DMBOK for data, ITIL for the service owner.
export type ProjectRoleKind =
  | "sponsor"
  | "manager"
  | "teamMember"
  | "userRepresentative"
  | "technicalLead"
  | "dataOwner"
  | "dataCustodian"
  | "dataSteward"
  | "projectSupport"
  | "serviceOwner";

/** A stakeholder's nearness to the work: primary ones shape what happens,
 * secondary ones are affected by it and kept informed. Carried on a
 * StakeholderMap entry, not on the project's own row. */
export type StakeholderTier = "primary" | "secondary";

/** How much power one stakeholder holds over one piece of work.
 *
 * A binding, not a container: the project already references the resources
 * it involves, stakeholders among them. This adds the one thing that
 * belongs to neither end, because a resource is declared once and used
 * across many projects while the power it holds is particular to each
 * (Programme Lead, 2026-09-28).
 *
 * Scoring is optional on purpose. Naming a stakeholder and assessing their
 * power are separate acts, and an entry with no score is one somebody has
 * declared but not yet placed — a state worth holding rather than one that
 * loses the entry. */
/** One stakeholder on a map: a Resource or a beneficiary group, exactly
 * one (TAXONOMY.md D42), with what it cares about in this work and the
 * role that owns the relationship. */
export interface StakeholderEntry {
  resource?: string;
  group?: string;
  stake?: string;
  owner?: Ref;
  influence?: number;
  interest?: number;
  tier?: StakeholderTier;
}

/** The work's own beneficiary groups, named on its problems and its
 * beneficiaries: the people it is for, offered first as stakeholders. */
export function groupsOf(spec: { problems?: ProblemLine[]; summary?: { problems?: ProblemLine[]; beneficiaries?: BeneficiaryLine[] } }): string[] {
  const out = new Set<string>();
  for (const b of spec.summary?.beneficiaries ?? []) if (b.group) out.add(b.group);
  for (const p of [...(spec.summary?.problems ?? []), ...(spec.problems ?? [])]) {
    for (const g of p.groups ?? []) out.add(g);
  }
  return [...out];
}

export interface StakeholderMapSpec {
  /** The work this map is about: a project, programme or operation. */
  scope: Ref;
  entries?: StakeholderEntry[];
}

export interface ProjectRole {
  /** What references point at, so a role is named in one place and every
   * mention of it follows a rename. */
  id?: string;
  role: ProjectRoleKind;
  /** The catalogue entry (kind Resource) this project draws on, and the
   * only place the role is named. Optional: knowing a project needs a
   * sponsor before knowing who is a state worth holding. */
  resource?: string;
  note?: string;
}

/** A standing measure this project moves, named by the project as a whole
 * with the reason it is named. A KPI is not a property of one key result:
 * one KPI may be moved by several projects (Programme Lead, 2026-09-26). */
export interface ProjectKPI {
  kpi: string;
  reason: string;
}

export interface ProjectSpec {
  summary: ProjectSummary;
  team: string;
  mandate?: Mandate[];
  /** Where a matter goes up when it cannot be settled here, nearest first
   * (TAXONOMY.md D44). */
  escalationRoute?: { kind?: string; id?: string; external?: string }[];
  funding?: FundingLine[];
  alignment?: ProjectAlignment;
  /** The projects and programmes this one depends on (engine TAXONOMY.md D46). */
  components?: { kind: "Project" | "Programme"; id: string; why?: string }[];
  milestones?: Milestone[];
  responsibilities?: Responsibility[];
  costs?: CostLine[];
  procurement?: ProcurementItem[];
  conditions?: Condition[];
  signOffs?: SignOff[];
  events?: ProjectEvent[];
  classification?: string;
  objectives?: ProjectObjective[];
  deliverables?: Deliverable[];
  kpis?: ProjectKPI[];
  successCriteria?: SuccessCriterion[];
  operation?: string;
  data?: DataUse;
  timeline?: Timeline;
  risks?: Risk[];
  compliance?: ComplianceItem[];
  resources?: ProjectRole[];
  /** A note per step of the walk, keyed by the step's own name. */
  notes?: Record<string, string>;
}

export interface ProjectManifest {
  apiVersion: "cartograph/v1";
  kind: "Project";
  /** alias is the short reference people quote this by; see @/alias. */
  metadata: { id: string; name: string; alias?: string };
  spec: ProjectSpec;
}

/** A blank, schema-valid-shaped spec for a brand new project. */
export function blankProjectSpec(): ProjectSpec {
  return {
    summary: { problems: [{ problem: {}, change: {} }] },
    team: "",
  };
}

// The eight Initiation sections, Closing and Landing, in the fixed order
// the stepper and Back/Next both use. The order is the order a project is
// chiselled into shape: the aim first (what is wrong, what will be
// different, by whose decision), then the goals it serves, what will prove
// it and who it is for, then what it produces, then where it stops. Each
// step turns a rougher shape into a sharper one.
//
// Each step is also one question held in one place, so nobody has to
// switch context and come back. Where a step needs an earlier answer to
// be answerable at all, that answer is shown on it rather than left to be
// remembered: Beneficiaries and Scope both open with what the aim, the
// goals and the deliverables already say. Everything the project needs
// around it (roles, funding, stakeholders) is one step, the way the
// organisation's own charter groups them under "Stakeholders and
// Resources", and it follows Scope directly.
export const INITIATION_SECTIONS = [
  "goals",
  "beneficiaries",
  "aim",
  "measures",
  "resources",
  "stakeholders",
  "scope",
  "deliverables",
  "timeline",
  "data",
  "risks",
  "success",
  "landing",
  "approval",
] as const;
export type InitiationSection = (typeof INITIATION_SECTIONS)[number];

/**
 * The seven stages a definition is walked in, each settling one thing, in
 * the order of the contract's own stages (engine TAXONOMY.md D33; a test
 * holds the two together). A stage is one screen with its steps as
 * sections. They are not the lifecycle: the three phases (Initiation,
 * Closing, Landing) are what the charter and the gates run on, and the
 * closing and landing pages stay for them.
 *
 *   Context     where it sits, the outcomes it serves, who owns it
 *   Problem     who it is for, and what is wrong for them
 *   Objectives  the change it makes, and how that is measured
 *   Governance  who decides, who pays, on whose authority, who holds power
 *   Scope       what it produces, and where it stops
 *   Plan        when, on what data, and what could go wrong
 *   Handover    what success is, and the service that runs the result
 */
export const STAGES = ["context", "problem", "objectives", "governance", "scope", "plan", "handover", "approval"] as const;
export type Stage = (typeof STAGES)[number];

/** The route each step lives at, as literals: the router types its links
 * from this union, so a mistyped path is a compile error and not a dead
 * link discovered in a browser. */
export type StepPath =
  | "/initiation/goals"
  | "/initiation/aim"
  | "/initiation/beneficiaries"
  | "/initiation/scope"
  | "/initiation/measures"
  | "/initiation/resources"
  | "/initiation/stakeholders"
  | "/initiation/deliverables"
  | "/initiation/success"
  | "/initiation/timeline"
  | "/initiation/data"
  | "/initiation/risks"
  | "/initiation/landing"
  | "/initiation/approval";

export interface Step {
  stage: Stage;
  phase: Phase;
  section: InitiationSection;
  path: StepPath;
}

const step = (stage: Stage, section: InitiationSection): Step => ({ stage, phase: "initiation", section, path: `/initiation/${section}` });

/** Every step, in the one order the stages walk. Roles come before the
 * steps that name them (acceptance, success criteria, escalation), and the
 * success criteria after the plan, so one can read from data the project
 * produces. */
export const STEPS: Step[] = [
  step("context", "goals"),
  // Beneficiaries first: the problem is stated about somebody.
  step("problem", "beneficiaries"),
  step("problem", "aim"),
  step("objectives", "measures"),
  step("governance", "resources"),
  step("governance", "stakeholders"),
  step("scope", "scope"),
  step("scope", "deliverables"),
  step("plan", "timeline"),
  step("plan", "data"),
  step("plan", "risks"),
  step("handover", "success"),
  step("handover", "landing"),
  step("approval", "approval"),
];

export function stepsOfStage(stage: Stage): Step[] {
  return STEPS.filter((s) => s.stage === stage);
}

export function stageOfSection(section: string): Stage {
  return STEPS.find((s) => s.section === section)?.stage ?? "context";
}

/** The first step of the whole definition: where a new project opens. */
export const FIRST_STEP = STEPS[0];

/** The literal id `spec.operation` carries when Landing's "Lands in" picks
 * its own first choice ("Define a new operation alongside") rather than an
 * existing Operation: never shown as the raw word "new" anywhere it is
 * displayed (card §2, Landing). */
export const NEW_OPERATION_ID = "new";

export const PHASES = ["initiation", "closing", "landing"] as const;
export type Phase = (typeof PHASES)[number];

/** Every section route, in the fixed order Back/Next walk through. */
/** Every section route, in the fixed order Back and Next walk through.
 * Derived from STEPS so the two can never disagree. */
export const ALL_SECTIONS: { phase: Phase; section: string; path: string }[] = STEPS.map(
  ({ phase, section, path }) => ({ phase, section, path }),
);
