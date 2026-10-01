import {
  BadgeCheck,
  Briefcase,
  CalendarSync,
  CircleCheck,
  Compass,
  Database,
  Download,
  Gauge,
  Milestone,
  Network,
  Package,
  Target,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Help } from "@/components/guidance";
import { VocabChip } from "@/components/vocab";
import { copy } from "@/copy";
import {
  frameworkCSV,
  RESULT_LEVELS,
  type FrameworkRow,
  type RowOrigin,
  type Verification,
  type VerificationKind,
} from "./derive";

const fc = copy.framework;

/**
 * A mark for what each row was read from.
 *
 * The same picture the definition flow uses for that step, so a row is
 * placed by the shape it already has elsewhere rather than by a word
 * repeated down the column (`projects/steps.tsx`, `programmes/types.ts`).
 */
const ORIGIN_ICON: Record<RowOrigin, LucideIcon> = {
  goal: Target,
  objective: Compass,
  criterion: CircleCheck,
  deliverable: Package,
  measure: Gauge,
  pathway: Waypoints,
  component: Network,
};

/**
 * A mark for the question each verification line answers.
 *
 * Five lines under one heading — a register, a cycle, two roles and a
 * moment — are answers to four different questions, and a flat list makes
 * the reader sort them out (Programme Lead, 2026-09-29). The register and
 * the cycle keep the marks their own kinds carry everywhere else.
 */
const VERIFICATION_ICON: Record<VerificationKind, LucideIcon> = {
  source: Database,
  cycle: CalendarSync,
  owner: Briefcase,
  confirmer: BadgeCheck,
  when: Milestone,
  role: Briefcase,
};

/** The matrix, downloaded as the one file every spreadsheet opens. Built
 * in the browser from the rows already on screen: nothing is stored, so
 * there is nothing for a server to hand out. */
function download(rows: FrameworkRow[], filename: string) {
  const csv = frameworkCSV(rows, fc.columns, {
    metric: (m) => copy.projects.success.metric[m] ?? m,
    verification: fc.verification,
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A column's plain contents: one line each, or a quiet dash where the
 * work says nothing. An empty cell is an answer here, so it is drawn
 * rather than left blank. */
function Cell({ items }: { items: string[] }) {
  if (items.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, i) => (
        <li key={i} className="text-pretty">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <span className="text-muted-foreground/60">—</span>;
}

/** How a result is verified: each line marked with the question it
 * answers, and the question itself as the mark's reading, so nothing
 * shown as a picture is lost to somebody who cannot see it. */
function VerificationCell({ items }: { items: Verification[] }) {
  if (items.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, i) => {
        const Icon = VERIFICATION_ICON[item.kind];
        const reading = fc.verification[item.kind] ?? item.kind;
        return (
          <li key={i} className="flex items-start gap-1.5">
            <span title={reading} className="inline-flex pt-0.5">
              <Icon className="size-3.5 shrink-0 text-muted-foreground" role="img" aria-label={reading} />
            </span>
            <span className="min-w-0 text-pretty">{item.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The results framework as a matrix, read-only.
 *
 * Levels down the side, the four logframe columns across. It is drawn
 * from the manifests every time it is opened, which is why there is no
 * save: a framework that can be edited here is a second copy of the work,
 * and a second copy is the thing this exists to avoid.
 */
export function FrameworkTable({
  rows,
  filename,
  empty,
}: {
  rows: FrameworkRow[];
  filename: string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;

  return (
    <div className="flex flex-col gap-4" data-cartograph-region="framework-table">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => download(rows, filename)}>
          <Download />
          {fc.download}
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {RESULT_LEVELS.map((level) => {
          const atLevel = rows.filter((r) => r.level === level);
          if (atLevel.length === 0) return null;
          return (
            <section key={level} className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <h2 className="text-sm font-semibold">{fc.levels[level]}</h2>
                <Help label={fc.levels[level]} hint={fc.levelHint[level]} />
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-3xl border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      {fc.columns.map((c, i) => (
                        <th
                          key={c}
                          className={`p-3 font-medium whitespace-nowrap ${i === 0 ? "w-[28%]" : ""}`}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {atLevel.map((row, i) => {
                      const OriginIcon = ORIGIN_ICON[row.origin];
                      return (
                        <tr key={i} className="border-b align-top last:border-0">
                          <td className="p-3">
                            <div className="flex items-start gap-2">
                              {/* The mark says what this row was read
                                  from; the word for it is its reading. */}
                              <span title={fc.origins[row.origin]} className="inline-flex pt-0.5">
                                <OriginIcon
                                  className="size-4 shrink-0 text-muted-foreground"
                                  role="img"
                                  aria-label={fc.origins[row.origin]}
                                />
                              </span>
                              <div className="flex min-w-0 flex-col gap-1">
                                <span className="font-medium text-pretty">{row.result}</span>
                                {row.reason ? (
                                  <span className="text-xs text-muted-foreground text-pretty">
                                    {row.reason}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-start gap-1.5">
                              {/* The dimension a criterion is judged on,
                                  as the mark the Success step gives it. */}
                              {row.metric ? <VocabChip vocab="successMetric" value={row.metric} /> : null}
                              {row.indicators.length > 0 || !row.metric ? (
                                <Cell items={row.indicators} />
                              ) : null}
                            </div>
                          </td>
                          <td className="p-3">
                            <VerificationCell items={row.verification} />
                          </td>
                          <td className="p-3">
                            <Cell items={row.assumptions} />
                          </td>
                          <td className="p-3">
                            <Cell items={row.from} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
