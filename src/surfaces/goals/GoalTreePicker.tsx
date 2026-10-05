import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronRight, CornerDownRight, Folder, FolderOpen, Search } from "lucide-react";

import type { GoalTree } from "@/client/port";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";
import { cn } from "@/lib/utils";
import { LevelMarkTag, levelName } from "./levels";
import type { GoalLevel } from "./types";

const tc = copy.goals.picker;

type Node = GoalTree["nodes"][number];

const PARENT: Record<GoalLevel, GoalLevel | undefined> = { goal: undefined, objective: "goal", outcome: "objective" };

/** A row of the tree as drawn: a goal, an objective, or the folder of
 * what is not placed yet. */
type Row = { key: string; node?: Node; label: string; depth: number; folder: boolean; selectable: boolean; open: boolean };

/**
 * Where a goal goes, chosen on the tree itself (engine TAXONOMY.md D28):
 * goals hold objectives as folders hold files, so the person sees what
 * sits beside the place they pick, not a list of names out of context.
 * Only the level above the one being placed can be picked; what is not
 * placed yet (D35) is its own folder, and can be picked too, so an
 * outcome can go under an objective defined a moment ago. The row the
 * item would land in shows it there.
 */
export function GoalTreePicker({
  tree,
  level,
  value,
  onChange,
  name,
  exclude,
  labelledBy,
}: {
  tree: GoalTree | undefined;
  /** The level of what is being placed. */
  level: GoalLevel;
  value: string;
  onChange: (parentId: string) => void;
  /** What is being placed, shown where it would land. */
  name?: string;
  /** The goal being moved: never offered as its own parent. */
  exclude?: string;
  labelledBy?: string;
}) {
  const parentLevel = PARENT[level];
  const levels = tree?.levels;
  const nodes = useMemo(() => tree?.nodes ?? [], [tree]);
  const unplaced = useMemo(() => (tree?.unplaced ?? []).filter((n) => n.level === parentLevel && n.id !== exclude), [tree, parentLevel, exclude]);
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);
  const q = query.trim().toLowerCase();
  const hit = (n: Node) => !q || n.name.toLowerCase().includes(q);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (!parentLevel) return out;
    for (const g of nodes) {
      if (g.level !== "goal") continue;
      if (parentLevel === "goal") {
        if (g.id !== exclude && hit(g)) out.push({ key: g.id, node: g, label: g.name, depth: 1, folder: false, selectable: true, open: false });
        continue;
      }
      const objectives = (g.children ?? []).filter((o) => o.level === "objective" && o.id !== exclude && (hit(o) || hit(g)));
      if (objectives.length === 0 && q) continue;
      const open = !!q || !closed.has(g.id);
      out.push({ key: g.id, node: g, label: g.name, depth: 1, folder: true, selectable: false, open });
      if (open) for (const o of objectives) out.push({ key: o.id, node: o, label: o.name, depth: 2, folder: false, selectable: true, open: false });
    }
    const loose = unplaced.filter(hit);
    if (loose.length) {
      const open = !!q || !closed.has("~unplaced");
      out.push({ key: "~unplaced", label: tc.unplaced, depth: 1, folder: true, selectable: false, open });
      if (open) for (const n of loose) out.push({ key: n.id, node: n, label: n.name, depth: 2, folder: false, selectable: true, open: false });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, unplaced, parentLevel, exclude, q, closed]);

  const selectable = rows.filter((r) => r.selectable).length;
  // The row that takes focus: the chosen one, else the first.
  const focusKey = rows.find((r) => r.key === value)?.key ?? rows[0]?.key;

  function toggle(key: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onKey(e: KeyboardEvent<HTMLLIElement>, row: Row, i: number) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []);
    const move = (to: number) => items[Math.max(0, Math.min(items.length - 1, to))]?.focus();
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "ArrowRight" && row.folder && !row.open) toggle(row.key);
    else if (e.key === "ArrowLeft" && row.folder && row.open) toggle(row.key);
    else if ((e.key === "Enter" || e.key === " ") && row.folder) toggle(row.key);
    else if ((e.key === "Enter" || e.key === " ") && row.selectable) onChange(row.key);
    else return;
    e.preventDefault();
  }

  if (!parentLevel) return null;
  return (
    <div className="flex flex-col gap-2" data-cartograph-field="/spec/parent">
      {selectable > 8 || q ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} aria-label={tc.find(levelName(parentLevel, levels))} className="pl-8" />
        </div>
      ) : null}
      <ul ref={listRef} role="tree" aria-labelledby={labelledBy} className="flex max-h-80 flex-col overflow-y-auto rounded-lg bg-muted/30 p-1 ring-1 ring-foreground/10" data-slot="goal-tree-picker">
        {rows.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">{q ? tc.noMatch : tc.empty(levelName(parentLevel, levels))}</li> : null}
        {rows.map((row, i) => {
          const chosen = row.selectable && row.key === value;
          return (
            <li
              key={row.key}
              role="treeitem"
              aria-level={row.depth}
              aria-expanded={row.folder ? row.open : undefined}
              aria-selected={row.selectable ? chosen : undefined}
              aria-disabled={!row.folder && !row.selectable ? true : undefined}
              tabIndex={row.key === focusKey ? 0 : -1}
              onKeyDown={(e) => onKey(e, row, i)}
              onClick={() => (row.folder ? toggle(row.key) : row.selectable ? onChange(row.key) : undefined)}
              data-tree-row={row.key}
              className={cn(
                "flex cursor-default flex-col rounded-md text-sm outline-none transition-colors duration-150 ease-standard focus-visible:ring-2 focus-visible:ring-ring",
                row.selectable && "cursor-pointer hover:bg-muted",
                chosen && "bg-primary/10 text-primary hover:bg-primary/15",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 px-2 py-1.5" style={{ paddingLeft: `${(row.depth - 1) * 1.25 + 0.5}rem` }}>
                {row.folder ? (
                  <>
                    <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-150", row.open && "rotate-90")} aria-hidden="true" />
                    {row.open ? <FolderOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Folder className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  </>
                ) : (
                  <span className="w-3.5 shrink-0" aria-hidden="true" />
                )}
                {row.node ? <LevelMarkTag level={row.node.level} /> : null}
                <span className={cn("min-w-0 truncate", row.folder && !row.node && "italic text-muted-foreground", chosen && "font-medium")}>{row.label}</span>
              </span>
              {chosen && name?.trim() ? (
                <span
                  className="cartograph-arrive flex min-w-0 items-center gap-2 px-2 pb-1.5 text-foreground"
                  style={{ paddingLeft: `${row.depth * 1.25 + 0.5}rem` }}
                  data-slot="lands-here"
                >
                  <CornerDownRight className="size-3.5 shrink-0 text-new" aria-hidden="true" />
                  <LevelMarkTag level={level} />
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="sr-only">{tc.landsHere}</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
