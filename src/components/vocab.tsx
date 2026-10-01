import type { LucideIcon } from "lucide-react";
import {
  Sprout,
  Flag,
  Mountain,
  ArrowRightLeft,
  Banknote,
  Building2,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Cog,
  Database,
  DatabasePlus,
  FileStack,
  FileText,
  FolderOpen,
  Handshake,
  Hash,
  Keyboard,
  Link2,
  Lock,
  Minus,
  OctagonAlert,
  Percent,
  Ratio,
  RefreshCw,
  Rows3,
  Ruler,
  Rss,
  ScrollText,
  Shapes,
  Smile,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Table2,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Users,
  HandHeart,
  Briefcase,
  ChartPie,
  CalendarSync,
  Warehouse,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { copy } from "@/copy";
import { cn } from "cn";

/**
 * A mark for every fixed word the app shows. One table, because the same
 * vocabulary turns up in a dialog's select, a directory cell and a project
 * row, and a picture read in one place should be the same picture in the
 * others.
 *
 * Words are not repeated here. They live in copy.ts, and this module looks
 * them up, so a label is changed in one file and follows the mark wherever
 * it is drawn. Only a chip's shorter reading is kept here, for the handful
 * of values whose full wording will not fit beside an icon.
 */
const ICONS = {
  resourceCategory: {
    "personRole": UserRound,
    orgUnit: Building2,
    "externalParty": Handshake,
    system: Cog,
    facility: Warehouse,
    other: Shapes,
  },
  dataSourceCategory: {
    database: Database,
    spreadsheet: Table2,
    "paperRecord": FileText,
    "formOrSurvey": ClipboardList,
    "operationalSystem": Cog,
    "apiOrFeed": Rss,
    "documentStore": FolderOpen,
  },
  handoff: {
    "apiOrFeed": Rss,
    "fileTransfer": ArrowRightLeft,
    "sharedDatabase": Database,
    "manualReentry": Keyboard,
    paper: ScrollText,
  },
  // What a project leaves behind, by shape: a register it stands up
  // itself, rows in something that already exists, files in a store, or a
  // periodic extract.
  dataOutput: {
    "newDataSource": DatabasePlus,
    "recordsInExistingSource": Rows3,
    "documentsOrFiles": FileStack,
    "extractOrReport": FileText,
  },
  // Which dimension of success a criterion measures. Six metric types,
  // plus compliance: the one kind that is satisfied rather than measured.
  successMetric: {
    efficiency: Timer,
    customer: Smile,
    team: Users,
    business: TrendingUp,
    future: Sprout,
    compliance: ShieldCheck,
  },
  personalData: { none: ShieldOff, personal: Shield, sensitive: ShieldAlert },
  refresh: {
    daily: RefreshCw,
    weekly: RefreshCw,
    monthly: RefreshCw,
    quarterly: RefreshCw,
    annual: RefreshCw,
    "irregular": RefreshCw,
  },
  riskType: {
    risk: TriangleAlert,
    issue: OctagonAlert,
    dependency: Link2,
    assumption: CircleHelp,
    constraint: Lock,
  },
  direction: { increase: TrendingUp, decrease: TrendingDown, reach: Target, maintain: Minus },
  measureKind: { percent: Percent, count: Hash, money: Banknote, ratio: Ratio, duration: Timer },
  periodMonths: { "1": CalendarDays, "3": CalendarDays, "6": CalendarDays, "12": CalendarDays },
  goalLevel: { goal: Mountain, objective: Target, outcome: Flag },
} satisfies Record<string, Record<string, LucideIcon>>;

export type VocabName = keyof typeof ICONS;

/** Every value a vocabulary has a mark for, so a test can walk them. */
export function vocabValues(vocab: VocabName): string[] {
  return Object.keys(ICONS[vocab]);
}

export const VOCAB_NAMES = Object.keys(ICONS) as VocabName[];

/** Where each vocabulary's words are kept. Read lazily, so this module
 * never depends on the order copy.ts is evaluated in. */
const WORDS: Record<VocabName, () => Record<string, string>> = {
  resourceCategory: () => copy.sheets.fieldValues.Resource?.category ?? {},
  dataSourceCategory: () => copy.sheets.fieldValues.DataSource?.category ?? {},
  handoff: () => copy.projects.data.handoff,
  dataOutput: () => copy.projects.data.output,
  successMetric: () => copy.projects.success.metric,
  personalData: () => copy.projects.data.personalData,
  refresh: () => copy.projects.data.refresh,
  riskType: () => copy.projects.risks.type,
  direction: () => copy.goals.keyResultDialog.direction,
  measureKind: () => copy.goals.keyResultDialog.kind,
  periodMonths: () => copy.sheets.fieldValues.ReportingCycle?.periodMonths ?? {},
  // A goal level is named by the instance's own tree, not by a fixed word.
  goalLevel: () => ({}),
};

/** Shorter readings, for a chip that has an icon beside it already. */
const SHORT: Partial<Record<VocabName, Record<string, string>>> = {
  resourceCategory: { "externalParty": "External" },
  dataSourceCategory: {
    "paperRecord": "Paper",
    "formOrSurvey": "Form",
    "operationalSystem": "System",
    "apiOrFeed": "Feed",
    "documentStore": "Documents",
  },
  handoff: { "apiOrFeed": "Feed", "fileTransfer": "File", "sharedDatabase": "Database", "manualReentry": "Re-entry" },
  dataOutput: {
    "newDataSource": "New source",
    "recordsInExistingSource": "Records",
    "documentsOrFiles": "Documents",
    "extractOrReport": "Extract",
  },
  periodMonths: { "6": "Half year" },
};

/**
 * A mark for each kind a directory holds.
 *
 * The directory index was eight cards with a word each and nothing to tell
 * them apart at a glance (Programme Lead, 2026-09-29). Here rather than in
 * the index, because a kind turns up in a card, a breadcrumb and a picker,
 * and the same rule holds as for every other word in this file: a picture
 * read in one place should be the same picture in the others.
 */
const KIND_ICONS: Record<string, LucideIcon> = {
  Team: Users,
  BeneficiaryGroup: HandHeart,
  Resource: Briefcase,
  Segment: ChartPie,
  Unit: Ruler,
  FundingSource: Banknote,
  Gap: TriangleAlert,
  Assumption: CircleHelp,
  DataSource: Database,
  ReportingCycle: CalendarSync,
};

/** The mark for a kind, or nothing for one that has none yet. */
export function kindIcon(kind: string): LucideIcon | undefined {
  return KIND_ICONS[kind];
}

/** Every kind with a mark, so a test can walk them against the sheets. */
export function kindsWithIcons(): string[] {
  return Object.keys(KIND_ICONS);
}

export function vocabIcon(vocab: VocabName, value: string | number | undefined): LucideIcon | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return (ICONS[vocab] as Record<string, LucideIcon>)[String(value)];
}

/** The full reading: a tooltip, an accessible name, a select option. */
export function vocabLabel(vocab: VocabName, value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  return WORDS[vocab]()[String(value)] ?? String(value);
}

/** The reading that fits beside a mark. */
export function vocabShortLabel(vocab: VocabName, value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  return SHORT[vocab]?.[String(value)] ?? vocabLabel(vocab, value);
}

/**
 * The mark alone, for a row with no room for a word. Never silent: the
 * full reading is the tooltip and the accessible name, so nothing shown
 * as a picture is lost to someone who cannot see it.
 */
export function VocabMark({
  vocab,
  value,
  className,
  decorative,
}: {
  vocab: VocabName;
  value: string | number | undefined;
  className?: string;
  /** Set where the word is already beside the mark (a toggle, a chip).
   * The mark is then hidden from a screen reader instead of read out a
   * second time, which is what turned "Percent" into "Percent Percent". */
  decorative?: boolean;
}) {
  const Icon = vocabIcon(vocab, value);
  if (!Icon) return null;
  const reading = vocabLabel(vocab, value);
  if (decorative) {
    return <Icon className={cn("size-4 shrink-0", className)} aria-hidden="true" />;
  }
  return (
    <span title={reading} className="inline-flex">
      <Icon className={cn("size-4 shrink-0 text-muted-foreground", className)} role="img" aria-label={reading} />
    </span>
  );
}

/** The mark and its short word, for a directory cell or a picked row. */
export function VocabChip({
  vocab,
  value,
  className,
}: {
  vocab: VocabName;
  value: string | number | undefined;
  className?: string;
}) {
  if (value === undefined || value === null || value === "") return null;
  const Icon = vocabIcon(vocab, value);
  const full = vocabLabel(vocab, value);
  return (
    <Badge variant="secondary" className={cn("gap-1", className)} title={full}>
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {vocabShortLabel(vocab, value)}
    </Badge>
  );
}

/** The mark and the full word, for inside a select option. */
export function VocabOption({ vocab, value }: { vocab: VocabName; value: string | number }) {
  const Icon = vocabIcon(vocab, value);
  return (
    <span className="flex items-center gap-2">
      {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
      {vocabLabel(vocab, value)}
    </span>
  );
}

/**
 * Which vocabulary a directory field speaks, by kind and property. Shared
 * by the directory table and the Add dialog, so a category cannot read one
 * way in a cell and another in the select that set it.
 */
const FIELD_VOCAB: Record<string, Record<string, VocabName>> = {
  Resource: { category: "resourceCategory" },
  DataSource: { category: "dataSourceCategory", refresh: "refresh" },
  ReportingCycle: { periodMonths: "periodMonths" },
};

export function fieldVocab(kind: string, property: string): VocabName | undefined {
  return FIELD_VOCAB[kind]?.[property];
}
