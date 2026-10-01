import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { defaultFilter } from "cmdk";
import { ArrowUpRight, ChevronRight, Folder, FolderOpen, Search, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy";

/** One record in an explorer list. */
export interface ExplorerRow {
  id: string;
  name: string;
  /** metadata.labels, matched by the filter along with the name. */
  labels?: Record<string, string>;
  /** Folder path, outermost first; empty for the top level. */
  folder: string[];
  /** Rows nested under this one (a project's components). */
  children?: ExplorerRow[];
  /** The row's marks: icons and counts only. */
  marks: ReactNode;
  /** What the preview pane shows for it. */
  preview: ReactNode;
}

const ec = copy.explorer;

/**
 * A register browsed like a file system (Programme Lead, 2026-09-30): the
 * records sit in folders drawn from what they belong to, each row carries
 * its own summary as marks, and the one selected opens in a preview pane
 * beside the list, so reading a register no longer means opening and
 * closing every record in turn. The filter is fuzzy over name and labels.
 *
 * Arrow keys move the selection and Enter opens it, as in a file manager.
 */
export function Explorer({
  title,
  icon: Icon,
  rows,
  loading,
  action,
  route,
}: {
  title: string;
  icon: LucideIcon;
  rows: ExplorerRow[];
  loading?: boolean;
  action?: ReactNode;
  /** The route that opens a record. */
  route: ExplorerRoute;
}) {
  const navigate = useNavigate();
  const open = (id: string) => navigate({ to: route, params: { id } } as never);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  const matches = (r: ExplorerRow): boolean => {
    if (!query.trim()) return true;
    const keywords = Object.entries(r.labels ?? {}).flatMap(([k, v]) => [k, v, `${k}:${v}`]);
    return defaultFilter(r.name, query.trim(), [...keywords, ...r.folder]) > 0 || (r.children ?? []).some(matches);
  };

  const visible = useMemo(() => rows.filter(matches), [rows, query]);
  const tree = useMemo(() => buildTree(visible), [visible]);
  const flat = useMemo(() => flatten(tree, closed, !!query.trim()), [tree, closed, query]);
  const current = flat.find((f) => f.type === "row" && f.row.id === selected);
  const selectedRow = current?.type === "row" ? current.row : undefined;

  // Keep a selection whenever there is something to select.
  useEffect(() => {
    const first = flat.find((f) => f.type === "row");
    if (!selectedRow && first?.type === "row") setSelected(first.row.id);
  }, [flat, selectedRow]);

  function move(delta: number) {
    const rowsOnly = flat.filter((f) => f.type === "row");
    const i = rowsOnly.findIndex((f) => f.type === "row" && f.row.id === selected);
    const next = rowsOnly[Math.min(rowsOnly.length - 1, Math.max(0, i + delta))];
    if (next?.type === "row") {
      setSelected(next.row.id);
      listRef.current?.querySelector(`[data-row="${CSS.escape(next.row.id)}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }

  const toggle = (key: string) =>
    setClosed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <div className="flex flex-col gap-4" data-cartograph-region="explorer">
      <div className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
          {title}
          <span className="text-sm font-normal text-muted-foreground">{rows.reduce((n, r) => n + 1 + (r.children?.length ?? 0), 0)}</span>
        </h1>
        {action}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              aria-label={ec.filter}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(1);
                  listRef.current?.focus();
                }
              }}
              className="pl-8"
            />
          </div>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : flat.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{query ? ec.noMatch : ec.empty}</p>
          ) : (
            <div
              ref={listRef}
              role="tree"
              aria-label={title}
              data-cartograph-region="explorer-list"
              tabIndex={0}
              className="flex flex-col rounded-lg border p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
                if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
                if (e.key === "Enter" && selected) open(selected);
              }}
            >
              {flat.map((f) =>
                f.type === "folder" ? (
                  <button
                    key={`f:${f.key}`}
                    type="button"
                    role="treeitem"
                    aria-expanded={f.open}
                    onClick={() => toggle(f.key)}
                    className="flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm font-medium hover:bg-muted/60"
                    style={{ paddingLeft: `${0.5 + f.depth * 1.25}rem` }}
                  >
                    <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${f.open ? "rotate-90" : ""}`} aria-hidden="true" />
                    {f.open ? <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{f.count}</span>
                  </button>
                ) : (
                  <div
                    key={`r:${f.row.id}:${f.depth}`}
                    role="treeitem"
                    aria-selected={f.row.id === selected}
                    data-row={f.row.id}
                    onClick={() => setSelected(f.row.id)}
                    onDoubleClick={() => open(f.row.id)}
                    className={`group flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 text-sm ${f.row.id === selected ? "bg-accent" : "hover:bg-muted/60"}`}
                    style={{ paddingLeft: `${1.4 + f.depth * 1.25}rem` }}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{f.row.name}</span>
                    <Link
                      to={route}
                      params={{ id: f.row.id } as never}
                      aria-label={ec.openNamed(f.row.name)}
                      className="shrink-0 rounded text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-[current]:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                    <span className="ml-auto flex shrink-0 items-center gap-2.5 text-xs text-muted-foreground">{f.row.marks}</span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        <aside aria-label={ec.preview} data-cartograph-region="explorer-preview" className="sticky top-4 hidden rounded-lg border p-4 lg:block">
          {selectedRow ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{selectedRow.name}</h2>
                <Button size="sm" variant="outline" asChild>
                  <Link to={route} params={{ id: selectedRow.id } as never}>{ec.open}</Link>
                </Button>
              </div>
              {selectedRow.preview}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{ec.nothingSelected}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

interface FolderNode {
  name: string;
  key: string;
  folders: Map<string, FolderNode>;
  rows: ExplorerRow[];
}

function buildTree(rows: ExplorerRow[]): FolderNode {
  const root: FolderNode = { name: "", key: "", folders: new Map(), rows: [] };
  for (const r of rows) {
    let at = root;
    for (const name of r.folder) {
      const key = `${at.key}/${name}`;
      if (!at.folders.has(name)) at.folders.set(name, { name, key, folders: new Map(), rows: [] });
      at = at.folders.get(name)!;
    }
    at.rows.push(r);
  }
  return root;
}

function countRows(f: FolderNode): number {
  let n = f.rows.reduce((a, r) => a + 1 + (r.children?.length ?? 0), 0);
  for (const c of f.folders.values()) n += countRows(c);
  return n;
}

type Flat =
  | { type: "folder"; key: string; name: string; depth: number; open: boolean; count: number }
  | { type: "row"; row: ExplorerRow; depth: number };

/** The tree as the list draws it: folders first, alphabetical, then rows,
 * with a row's own children indented under it. A filter opens every
 * folder, so a match is never hidden in a closed one. */
function flatten(root: FolderNode, closed: Set<string>, filtering: boolean): Flat[] {
  const out: Flat[] = [];
  const walk = (f: FolderNode, depth: number) => {
    const folders = [...f.folders.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const c of folders) {
      const open = filtering || !closed.has(c.key);
      out.push({ type: "folder", key: c.key, name: c.name, depth, open, count: countRows(c) });
      if (open) walk(c, depth + 1);
    }
    for (const r of [...f.rows].sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ type: "row", row: r, depth });
      for (const child of r.children ?? []) out.push({ type: "row", row: child, depth: depth + 1 });
    }
  };
  walk(root, 0);
  return out;
}

/** A mark: an icon and a count, or an icon alone for a yes or no. Absent
 * is drawn faint and struck through, so it reads in black and white. */
export function Mark({ icon: I, label, n, on }: { icon: LucideIcon; label: string; n?: number; on?: boolean }) {
  const present = n !== undefined ? n > 0 : !!on;
  const text = n !== undefined ? `${label}: ${n}` : `${label}: ${present ? ec.yes : ec.no}`;
  return (
    <span
      className={`relative flex items-center gap-0.5 ${present ? "" : "opacity-35"}`}
      aria-label={text}
      title={text}
      role="img"
    >
      <I className="size-3.5" aria-hidden="true" />
      {n !== undefined ? <span className="tabular-nums">{n}</span> : null}
      {!present && n === undefined ? (
        <span aria-hidden="true" className="absolute top-1/2 left-0 h-px w-3.5 -rotate-45 bg-current" />
      ) : null}
    </span>
  );
}

/** One line of the preview: an icon, a standard noun, a value. */
export function Fact({ icon: I, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "" || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div className="grid grid-cols-[1rem_7rem_minmax(0,1fr)] items-start gap-2 text-sm">
      <I className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export type ExplorerRoute = "/projects/$id" | "/programmes/$id" | "/operations/$id" | "/gaps/$id" | "/kpis/$id";
