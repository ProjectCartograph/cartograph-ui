import type { ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import { copy } from "@/copy";

const wc = copy.changeWords;

// The kinds a field may name, so a change shows a record's name, never
// its id.
const NAMED_KINDS = [
  "Goal", "Gap", "BeneficiaryGroup", "Resource", "Team", "KPI", "Segment", "DataSource",
  "Programme", "Portfolio", "Operation", "Project", "FundingSource", "Unit", "Assumption", "ReportingCycle",
];

/** Every record's name by id, across the kinds a field may name. */
export function useRecordNames(): Map<string, string> {
  const client = useClient();
  const lists = useQueries({
    queries: NAMED_KINDS.map((kind) => ({
      queryKey: ["manifests", kind],
      queryFn: () => client.list(kind),
      staleTime: 30_000,
    })),
  });
  const names = new Map<string, string>();
  for (const q of lists) for (const s of (q.data ?? []) as { id: string; name: string }[]) if (s.name) names.set(s.id, s.name);
  return names;
}

/** A field's words: its key as a person reads it. */
function word(key: string): string {
  return wc.fields[key] ?? sentenceCase(key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase());
}

/** One of a list, by its list's name: problems, 0 reads "Problem 1". */
function itemOf(list: string, index: number): string {
  const one = wc.singular[list] ?? word(list).replace(/s$/, "");
  return `${sentenceCase(one)} ${index + 1}`;
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Where a change is, in words: /spec/summary/problems/0/change/what reads
 * "Problem 1 › Intended change". The spec and summary wrappers say
 * nothing to a person and are left out.
 */
export function changePlace(path: string): string {
  const parts = path.split("/").filter(Boolean).map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  const words: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === 0 && (p === "spec" || p === "metadata")) continue;
    if (p === "summary" && i === 1) continue;
    // A problem's two halves hold fields that already say which half.
    if ((p === "problem" || p === "change") && i < parts.length - 1) continue;
    if (/^\d+$/.test(p)) {
      const list = words.length > 0 ? parts[i - 1] : "";
      if (words.length > 0) words.pop();
      words.push(itemOf(list, Number(p)));
      continue;
    }
    words.push(word(p));
  }
  return words.join(" › ") || wc.wholeRecord;
}

/** A value as a person reads it: text as written, a record by its name, a
 * period as from and to, a list one per line, a group of fields as a
 * small list of named values. Never as data. */
export function Value({ v, names }: { v: unknown; names: Map<string, string> }): ReactNode {
  if (v === undefined || v === null || v === "") return <span className="text-muted-foreground">{wc.nothing}</span>;
  if (typeof v === "string") return <span className="whitespace-pre-wrap">{names.get(v) ?? v}</span>;
  if (typeof v === "number") return <span>{v.toLocaleString()}</span>;
  if (typeof v === "boolean") return <span>{v ? wc.yes : wc.no}</span>;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground">{wc.nothing}</span>;
    if (v.every((x) => typeof x !== "object" || x === null)) {
      return <span>{v.map((x) => (typeof x === "string" ? (names.get(x) ?? x) : String(x))).join(", ")}</span>;
    }
    return (
      <ol className="flex flex-col gap-2">
        {v.map((x, i) => (
          <li key={i} className="rounded-md border border-current/10 p-2">
            <Value v={x} names={names} />
          </li>
        ))}
      </ol>
    );
  }
  const o = v as Record<string, unknown>;
  // Shapes read better as a phrase than as their parts.
  if (typeof o.start === "string" && typeof o.end === "string" && Object.keys(o).length === 2) return <span>{wc.period(o.start, o.end)}</span>;
  if ("value" in o && typeof o.date === "string" && Object.keys(o).length <= 3) return <span>{wc.dated(String(o.value), o.date)}</span>;
  const keys = Object.keys(o).filter((k) => k !== "id" && !isEmpty(o[k]));
  if (keys.length === 0) return <span className="text-muted-foreground">{wc.nothing}</span>;
  return (
    <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[max-content_1fr]">
      {keys.map((k) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{word(k)}</dt>
          <dd>
            <Value v={o[k]} names={names} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One change: where it is, and what it was and is, in words. */
export function ChangeRow({ change, names, removedText }: { change: { path: string; op: string; from?: unknown; to?: unknown }; names: Map<string, string>; removedText?: string }) {
  return (
    <div className="grid gap-1.5 p-2.5 sm:grid-cols-[14rem_1fr]" data-cartograph-change={change.path}>
      <dt className="text-sm font-medium">{changePlace(change.path)}</dt>
      <dd className="flex flex-col gap-1.5 text-sm">
        {change.op !== "add" && change.from !== undefined ? (
          <div className="rounded bg-destructive/10 px-2 py-1 text-destructive">
            <span className="mr-1.5 text-xs font-medium uppercase">{change.op === "remove" ? wc.removed : wc.was}</span>
            <span className="line-through decoration-destructive/40">
              <Value v={change.from} names={names} />
            </span>
          </div>
        ) : null}
        {change.op !== "remove" ? (
          <div className="rounded bg-success/10 px-2 py-1 text-success">
            <span className="mr-1.5 text-xs font-medium uppercase">{change.op === "add" ? wc.added : wc.now}</span>
            <Value v={change.to} names={names} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{removedText ?? wc.removedNote}</span>
        )}
      </dd>
    </div>
  );
}

/** Whether a value says nothing: blank, an empty list, or a group of
 * fields that are all blank. */
function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.every(isEmpty);
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).every(([k, x]) => k === "id" || isEmpty(x));
  return false;
}

// What every record carries and nobody reads as a change.
const PLUMBING = new Set(["/apiVersion", "/kind", "/metadata/id"]);

/**
 * The changes a person reads: a new record's whole spec or metadata is
 * split into one change per field, the plumbing every record carries is
 * left out, and a change to nothing but blanks is not a change.
 */
export function readableChanges<C extends { path: string; op: string; from?: unknown; to?: unknown }>(changes: C[]): C[] {
  const out: C[] = [];
  for (const c of changes) {
    if (PLUMBING.has(c.path)) continue;
    const whole = (c.path === "/spec" || c.path === "/metadata" || c.path === "") && c.op === "add" && c.to && typeof c.to === "object" && !Array.isArray(c.to);
    if (whole) {
      for (const [k, v] of Object.entries(c.to as Record<string, unknown>)) {
        const path = `${c.path}/${k}`;
        if (!PLUMBING.has(path) && !isEmpty(v)) out.push({ ...c, path, to: v });
      }
      continue;
    }
    if (c.op === "add" && isEmpty(c.to)) continue;
    out.push(c);
  }
  return out;
}
