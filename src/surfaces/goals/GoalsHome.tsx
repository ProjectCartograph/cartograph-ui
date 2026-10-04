import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Gauge, Layers, ListChecks, MoreHorizontal, Plus, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useClient } from "@/client/context";
import { copy, plusNoun } from "@/copy";
import { Term } from "@/components/Term";
import { ErrorAlert } from "@/components/error-alert";
import { goalReferencesQueryOptions, projectReferencesQueryOptions, useGoalTree } from "./api";
import { InlineTitle } from "./InlineTitle";
import { createGoal, deleteGoal, moveGoal, renameGoal } from "./mutations";
import { LevelMarkTag, levelName, levelStyle } from "./levels";
import { SmartMarks } from "./SmartMarks";
import { type GoalNode } from "./tree-types";
import type { GoalLevel } from "./types";
import { slugify } from "@/surfaces/sheet/schema";

const hc = copy.goals.home;

/** The drag payload type a goal card sets and a drop zone accepts. */
const GOAL_DRAG_TYPE = "text/cartograph-goal-id";

function carriesGoal(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(GOAL_DRAG_TYPE);
}

function draggedLevel(e: React.DragEvent): GoalLevel | null {
  const types = Array.from(e.dataTransfer.types);
  const levelType = types.find((t) => t.startsWith("text/cartograph-goal-level-"));
  if (!levelType) return null;
  const level = levelType.replace("text/cartograph-goal-level-", "");
  if (level === "goal" || level === "objective" || level === "outcome") {
    return level as GoalLevel;
  }
  return null;
}

/** Marks the card as the drag source: the nested card (not its strategic
 * parent) owns the payload, and the card, not the link inside it, is what
 * the browser drags. */
function startGoalDrag(e: React.DragEvent, id: string, level: GoalLevel) {
  e.stopPropagation();
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(GOAL_DRAG_TYPE, id);
  e.dataTransfer.setData(`text/cartograph-goal-level-${level}`, level);
}

const ALIGN_KINDS = ["Project", "Programme", "Operation", "KPI"] as const;
type AlignKind = (typeof ALIGN_KINDS)[number];

const KIND_ICON: Record<AlignKind, typeof Gauge> = {
  Project: FolderKanban,
  Programme: Layers,
  Operation: Settings2,
  KPI: Gauge,
};

/**
 * A card's contents as marks: its key results and what is aligned to it,
 * one icon and count per kind, names on hover. Replaced a line reading
 * "0 key results" and two cut-off name chips per card (Programme Lead,
 * 2026-09-30: far too much text).
 */
function CardMarks({ keyResults, items, smart }: { keyResults: number; items: { kind: string; id: string; name: string }[]; smart?: GoalNode["smart"] }) {
  const byKind = ALIGN_KINDS.map((k) => ({ kind: k, names: items.filter((s) => s.kind === k).map((s) => s.name) }))
    .filter((g) => g.names.length > 0);
  return (
    <div className="flex flex-wrap items-center gap-3 pl-6 text-xs text-muted-foreground">
      <SmartMarks smart={smart} />
      {keyResults > 0 ? (
        <span className="flex items-center gap-1" aria-label={hc.keyResultCount(keyResults)} title={hc.keyResultCount(keyResults)}>
          <ListChecks className="size-3.5" aria-hidden="true" />
          {keyResults}
        </span>
      ) : null}
      {byKind.map(({ kind, names }) => {
        const Icon = KIND_ICON[kind];
        const label = `${hc.filters[KIND_TO_FILTER[kind]]}: ${names.length}`;
        return (
          <Tooltip key={kind}>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1" aria-label={label}>
                <Icon className="size-3.5" aria-hidden="true" />
                {names.length}
              </span>
            </TooltipTrigger>
            <TooltipContent>{names.join(", ")}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

const KIND_TO_FILTER: Record<AlignKind, keyof typeof hc.filters> = {
  Project: "projects",
  Programme: "programmes",
  Operation: "operations",
  KPI: "kpis",
};

/** "Add a pillar" / "Add a strategic goal": title only, inline, save on
 * Enter (card §5: "no dialog, no team"). Opens the new goal's editor only
 * if the person then clicks the new card. */
/** An add row named by the tree's own name for the level ("New outcome"). */
function AddLevelRow({ level, placeholder, onAdd }: { level: GoalLevel; placeholder: string; onAdd: (name: string) => void }) {
  const tree = useGoalTree();
  return <InlineAddRow label={hc.newLevel(levelName(level, tree.data?.levels))} placeholder={placeholder} onAdd={onAdd} />;
}

function InlineAddRow({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={label}
        className="rounded-lg border border-dashed p-3 text-left text-sm text-muted-foreground hover:bg-accent"
      >
        <span className="flex items-center gap-1 font-medium text-foreground">
          <Plus className="size-4" />
          {plusNoun(label)}
        </span>
      </button>
    );
  }
  return (
    <Input
      autoFocus
      data-cartograph-field="/metadata/name"
      value={name}
      placeholder={placeholder}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => {
        setEditing(false);
        setName("");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const trimmed = name.trim();
          setEditing(false);
          setName("");
          if (trimmed) onAdd(trimmed);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
          setName("");
        }
      }}
    />
  );
}

function GoalCardMenu({
  node,
  pillars,
  strategicGoals,
  onMove,
  onDeleteAttempt,
}: {
  node: GoalNode;
  pillars: GoalNode[];
  strategicGoals: GoalNode[];
  onMove: (parentId: string) => void;
  onDeleteAttempt: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);

  const moveOptions = node.level === "objective" ? pillars : strategicGoals;
  const canMove = node.level === "objective" || node.level === "outcome";

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={hc.menu.trigger(node.name)}
            title={hc.menu.trigger(node.name)}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMove ? (
            <DropdownMenuItem onSelect={() => setMoveOpen(true)}>{hc.menu.moveTo}</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onSelect={onDeleteAttempt}>
            {hc.menu.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {moveOpen ? (
        <div className="absolute right-2 top-8 z-10 w-48 rounded-lg border bg-popover p-2 shadow-md">
          <Select
            defaultOpen
            onOpenChange={(open) => {
              if (!open) setMoveOpen(false);
            }}
            onValueChange={(v) => {
              setMoveOpen(false);
              onMove(v);
            }}
          >
            <SelectTrigger className="w-full" data-cartograph-field="/spec/parent">
              <SelectValue placeholder={hc.menu.moveTo} />
            </SelectTrigger>
            <SelectContent>
              {moveOptions
                .filter((p) => p.id !== node.parent)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}


function FunctionalGoalCard({
  node,
  activeFilters,
  strategicGoals,
}: {
  node: GoalNode;
  activeFilters: Set<AlignKind>;
  strategicGoals: GoalNode[];
}) {
  const queryClient = useQueryClient();
  const client = useClient();
  const refsQuery = useQuery(goalReferencesQueryOptions(client, node.id));
  const items = (refsQuery.data?.incoming ?? []).filter((s) =>
    (ALIGN_KINDS as readonly string[]).includes(s.kind)
  );
  const filtered =
    activeFilters.size === 0 ? items : items.filter((s) => activeFilters.has(s.kind as AlignKind));

  const [deleteRefusal, setDeleteRefusal] = useState<string[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [moveError, setMoveError] = useState<{ path: string; message: string }[] | null>(null);
  const [renameError, setRenameError] = useState<{ path: string; message: string }[] | null>(null);

  async function handleDelete() {
    setConfirmOpen(false);
    const result = await deleteGoal(client, node.id, deleteReason);
    setDeleteReason("");
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    } else {
      setDeleteRefusal(result.problems);
    }
  }

  async function handleMove(newParentId: string) {
    const result = await moveGoal(client, node.id, newParentId);
    if (!result.ok) {
      setMoveError(result.problems);
    } else {
      await queryClient.refetchQueries({ queryKey: ["goal-tree"] });
      await queryClient.refetchQueries({ queryKey: ["goal-manifest", node.id] });
    }
  }

  async function handleRename(next: string) {
    try {
      const result = await renameGoal(client, node.id, next);
      if (!result.ok) {
        setRenameError(result.problems);
      } else {
        await queryClient.refetchQueries({ queryKey: ["goal-tree"] });
        await queryClient.refetchQueries({ queryKey: ["goal-manifest", node.id] });
      }
    } catch (e) {
      setRenameError([{ path: "rename", message: String(e) }]);
    }
  }

  return (
    <>
      <Card
        data-cartograph-region={`goal-${node.id}`}
        draggable
        onDragStart={(e) => startGoalDrag(e, node.id, node.level as GoalLevel)}
        className={`relative gap-2 p-3 transition-colors hover:bg-accent ${levelStyle(node.level).card}`}
      >
        <div className="flex items-start justify-between gap-2">
          <LevelMarkTag level={node.level} />
          <Link to="/goals/$id" params={{ id: node.id }} className="min-w-0 flex-1" draggable={false}>
            <InlineTitle data-cartograph-field="/metadata/name" value={node.name} onSave={handleRename} className="text-sm font-medium" />
          </Link>
          <GoalCardMenu
            node={node}
            pillars={strategicGoals}
            strategicGoals={strategicGoals}
            onMove={handleMove}
            onDeleteAttempt={() => setConfirmOpen(true)}
          />
        </div>
        <Link to="/goals/$id" params={{ id: node.id }} draggable={false}>
          <CardMarks keyResults={node.keyResults} items={filtered} smart={node.smart} />
        </Link>
      </Card>

      <AlertDialog open={deleteRefusal !== null} onOpenChange={(open) => !open && setDeleteRefusal(null)}>
        <AlertDialogContent data-cartograph-region="delete-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>{hc.deleteBlockedTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {hc.deleteBlockedBody}
              <ul className="mt-2 list-disc pl-5">
                {(deleteRefusal ?? []).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteRefusal(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => {
        setConfirmOpen(open);
        if (!open) setDeleteReason("");
      }}>
        <AlertDialogContent data-cartograph-region="delete-goal">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {node.name}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div>The file stays in the vault and the item can be recovered.</div>
              <div>
                <Label htmlFor="delete-reason" className="text-xs">Reason for removal</Label>
                <Input
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Why is this being removed?"
                  className="mt-1"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hc.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!deleteReason.trim()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renameError !== null} onOpenChange={(open) => !open && setRenameError(null)}>
        <AlertDialogContent data-cartograph-region="rename-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to rename goal</AlertDialogTitle>
            <AlertDialogDescription>
              The rename operation could not be saved.
              {renameError && renameError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {renameError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRenameError(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={moveError !== null} onOpenChange={(open) => !open && setMoveError(null)}>
        <AlertDialogContent data-cartograph-region="move-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to move goal</AlertDialogTitle>
            <AlertDialogDescription>
              The move operation could not be saved.
              {moveError && moveError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {moveError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMoveError(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StrategicGoalCard({
  node,
  activeFilters,
  pillars,
}: {
  node: GoalNode;
  activeFilters: Set<AlignKind>;
  pillars: GoalNode[];
}) {
  const queryClient = useQueryClient();
  const client = useClient();
  const refsQuery = useQuery(goalReferencesQueryOptions(client, node.id));
  const items = (refsQuery.data?.incoming ?? []).filter((s) =>
    (ALIGN_KINDS as readonly string[]).includes(s.kind)
  );
  const filtered =
    activeFilters.size === 0 ? items : items.filter((s) => activeFilters.has(s.kind as AlignKind));

  const [deleteRefusal, setDeleteRefusal] = useState<string[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [moveError, setMoveError] = useState<{ path: string; message: string }[] | null>(null);
  const [renameError, setRenameError] = useState<{ path: string; message: string }[] | null>(null);
  const [addError, setAddError] = useState<{ path: string; message: string }[] | null>(null);
  const [dropError, setDropError] = useState<{ path: string; message: string }[] | null>(null);
  const dragDepth = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  const allStrategicGoals = useMemo(
    () => pillars.flatMap((p) => p.children ?? []),
    [pillars]
  );

  async function handleDelete() {
    setConfirmOpen(false);
    const result = await deleteGoal(client, node.id, deleteReason);
    setDeleteReason("");
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    } else {
      setDeleteRefusal(result.problems);
    }
  }

  async function handleMove(newParentId: string) {
    const result = await moveGoal(client, node.id, newParentId);
    if (!result.ok) {
      setMoveError(result.problems);
    } else {
      await queryClient.refetchQueries({ queryKey: ["goal-tree"] });
      await queryClient.refetchQueries({ queryKey: ["goal-manifest", node.id] });
    }
  }

  async function handleRename(next: string) {
    try {
      const result = await renameGoal(client, node.id, next);
      if (!result.ok) {
        setRenameError(result.problems);
      } else {
        await queryClient.refetchQueries({ queryKey: ["goal-tree"] });
        await queryClient.refetchQueries({ queryKey: ["goal-manifest", node.id] });
      }
    } catch (e) {
      setRenameError([{ path: "rename", message: String(e) }]);
    }
  }

  async function handleAddFunctional(name: string) {
    const id = slugify(name);
    if (!id) return;
    const result = await createGoal(client, id, name, "outcome", node.id);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    } else if (result.conflict) {
      setAddError([{ path: "name", message: "A goal with this name already exists. Rename the other goal or choose another name." }]);
    } else {
      setAddError(result.problems);
    }
  }

  return (
    <>
      <Card
        data-cartograph-region={`goal-${node.id}`}
        draggable
        onDragStart={(e) => startGoalDrag(e, node.id, node.level as GoalLevel)}
        className={`relative gap-2 p-3 transition-colors hover:bg-accent ${levelStyle(node.level).card}`}
      >
        <div className="flex items-start justify-between gap-2">
          <LevelMarkTag level={node.level} />
          <Link to="/goals/$id" params={{ id: node.id }} className="min-w-0 flex-1" draggable={false}>
            <InlineTitle data-cartograph-field="/metadata/name" value={node.name} onSave={handleRename} className="text-sm font-medium" />
          </Link>
          <GoalCardMenu
            node={node}
            pillars={pillars}
            strategicGoals={allStrategicGoals}
            onMove={handleMove}
            onDeleteAttempt={() => setConfirmOpen(true)}
          />
        </div>
        <Link to="/goals/$id" params={{ id: node.id }} draggable={false}>
          <CardMarks keyResults={node.keyResults} items={filtered} smart={node.smart} />
        </Link>
      </Card>

      <div
        data-slot="strategic-drop"
        className={`ml-2 flex flex-col gap-3 border-l pl-4 rounded-lg p-1 ${dragOver ? "bg-accent" : ""}`}
        onDragEnter={(e) => {
          if (!carriesGoal(e)) return;
          const level = draggedLevel(e);
          if (level !== "outcome") return;
          e.preventDefault();
          e.stopPropagation();
          dragDepth.current += 1;
          setDragOver(true);
        }}
        onDragOver={(e) => {
          if (!carriesGoal(e)) return;
          const level = draggedLevel(e);
          if (level !== "outcome") return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragOver(false);
        }}
        onDrop={async (e) => {
          // A goal of another level bubbles to the pillar column, which
          // moves a strategic goal and refuses the rest.
          if (!carriesGoal(e) || draggedLevel(e) !== "outcome") return;
          e.preventDefault();
          e.stopPropagation();
          dragDepth.current = 0;
          setDragOver(false);
          const goalId = e.dataTransfer.getData(GOAL_DRAG_TYPE);
          if (!goalId || goalId === node.id || node.children.some((c) => c.id === goalId)) return;
          const result = await moveGoal(client, goalId, node.id);
          if (!result.ok) {
            setDropError(result.problems);
          } else {
            queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
          }
        }}
      >
        {node.children.map((child) => (
          child.level === "outcome" ? (
            <FunctionalGoalCard
              key={child.id}
              node={child}
              activeFilters={activeFilters}
              strategicGoals={allStrategicGoals}
            />
          ) : (
            <div key={child.id} className="flex flex-col gap-1">
              <Badge variant="destructive" className="self-start">
                {hc.wrongLevel(child.level, "objective")}
              </Badge>
              <StrategicGoalCard node={child} activeFilters={activeFilters} pillars={pillars} />
            </div>
          )
        ))}
        <AddLevelRow level="outcome" placeholder={hc.addNamePlaceholder} onAdd={handleAddFunctional} />
      </div>

      <AlertDialog open={deleteRefusal !== null} onOpenChange={(open) => !open && setDeleteRefusal(null)}>
        <AlertDialogContent data-cartograph-region="delete-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>{hc.deleteBlockedTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {hc.deleteBlockedBody}
              <ul className="mt-2 list-disc pl-5">
                {(deleteRefusal ?? []).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteRefusal(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => {
        setConfirmOpen(open);
        if (!open) setDeleteReason("");
      }}>
        <AlertDialogContent data-cartograph-region="delete-goal">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {node.name}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div>The file stays in the vault and the item can be recovered.</div>
              <div>
                <Label htmlFor="strategic-delete-reason" className="text-xs">Reason for removal</Label>
                <Input
                  id="strategic-delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Why is this being removed?"
                  className="mt-1"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hc.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!deleteReason.trim()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renameError !== null} onOpenChange={(open) => !open && setRenameError(null)}>
        <AlertDialogContent data-cartograph-region="rename-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to rename goal</AlertDialogTitle>
            <AlertDialogDescription>
              The rename operation could not be saved.
              {renameError && renameError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {renameError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRenameError(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={moveError !== null} onOpenChange={(open) => !open && setMoveError(null)}>
        <AlertDialogContent data-cartograph-region="move-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to move goal</AlertDialogTitle>
            <AlertDialogDescription>
              The move operation could not be saved.
              {moveError && moveError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {moveError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMoveError(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={addError !== null} onOpenChange={(open) => !open && setAddError(null)}>
        <AlertDialogContent data-cartograph-region="add-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to add goal</AlertDialogTitle>
            <AlertDialogDescription>
              The goal could not be added.
              {addError && addError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {addError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAddError(null)}>Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dropError !== null} onOpenChange={(open) => !open && setDropError(null)}>
        <AlertDialogContent data-cartograph-region="drop-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to move goal</AlertDialogTitle>
            <AlertDialogDescription>
              The move operation could not be saved.
              {dropError && dropError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {dropError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDropError(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PillarColumn({
  node,
  activeFilters,
  pillars,
}: {
  node: GoalNode;
  activeFilters: Set<AlignKind>;
  pillars: GoalNode[];
}) {
  const queryClient = useQueryClient();
  const client = useClient();
  const [dragOver, setDragOver] = useState(false);
  // dragenter/dragleave fire for every child the pointer crosses; the depth
  // counter keeps the highlight steady until the pointer leaves the column.
  const dragDepth = useRef(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteRefusal, setDeleteRefusal] = useState<string[] | null>(null);
  const [renameError, setRenameError] = useState<{ path: string; message: string }[] | null>(null);
  const [moveError, setMoveError] = useState<{ path: string; message: string }[] | null>(null);
  const [addError, setAddError] = useState<{ path: string; message: string }[] | null>(null);

  async function handleRename(next: string) {
    try {
      const result = await renameGoal(client, node.id, next);
      if (!result.ok) {
        setRenameError(result.problems);
      } else {
        await queryClient.refetchQueries({ queryKey: ["goal-tree"] });
        await queryClient.refetchQueries({ queryKey: ["goal-manifest", node.id] });
      }
    } catch (e) {
      setRenameError([{ path: "rename", message: String(e) }]);
    }
  }

  async function handleAddStrategic(name: string) {
    const id = slugify(name);
    if (!id) return;
    const result = await createGoal(client, id, name, "objective", node.id);
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    } else if (result.conflict) {
      setAddError([{ path: "name", message: "A goal with this name already exists. Rename the other goal or choose another name." }]);
    } else {
      setAddError(result.problems);
    }
  }

  async function handleDelete() {
    setConfirmOpen(false);
    const result = await deleteGoal(client, node.id, deleteReason);
    setDeleteReason("");
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    } else {
      setDeleteRefusal(result.problems);
    }
  }

  return (
    <div
      data-slot="pillar-column"
      className={`flex flex-col gap-3 rounded-lg p-1 ${dragOver ? "bg-accent" : ""}`}
      onDragEnter={(e) => {
        if (!carriesGoal(e)) return;
        e.preventDefault();
        if (draggedLevel(e) !== "objective") return;
        dragDepth.current += 1;
        setDragOver(true);
      }}
      onDragOver={(e) => {
        if (!carriesGoal(e)) return;
        // Any goal drag is claimed so the drop reaches the handler below,
        // where a wrong level is refused with the rule's own message.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragOver(false);
      }}
      onDrop={async (e) => {
        if (!carriesGoal(e)) return;
        const level = draggedLevel(e);
        if (level !== "objective") {
          e.preventDefault();
          dragDepth.current = 0;
          setDragOver(false);
          setMoveError([{ path: "/spec/parent", message: `parent goal "${node.name}" is level "goal", not "objective"` }]);
          return;
        }
        e.preventDefault();
        dragDepth.current = 0;
        setDragOver(false);
        const goalId = e.dataTransfer.getData(GOAL_DRAG_TYPE);
        if (!goalId || goalId === node.id || node.children.some((c) => c.id === goalId)) return;
        const result = await moveGoal(client, goalId, node.id);
        if (result.ok) {
          queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
        } else {
          setMoveError(result.problems);
        }
      }}
    >
      <Card
        data-cartograph-region={`goal-${node.id}`}
        className={`relative gap-1 p-4 transition-colors hover:bg-accent ${levelStyle(node.level).card}`}
      >
        <div className="flex items-start justify-between gap-2">
          <LevelMarkTag level={node.level} />
          <Link to="/goals/$id" params={{ id: node.id }} className="min-w-0 flex-1" draggable={false}>
            <InlineTitle data-cartograph-field="/metadata/name" value={node.name} onSave={handleRename} as="h1" className="text-base font-semibold" />
          </Link>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label={hc.menu.trigger(node.name)}
                  title={hc.menu.trigger(node.name)}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                  {hc.menu.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>
      <div className="ml-2 flex flex-col gap-3 border-l pl-4">
        {node.children.map((child) => (
          child.level === "objective" ? (
            <StrategicGoalCard key={child.id} node={child} activeFilters={activeFilters} pillars={pillars} />
          ) : (
            <div key={child.id} className="flex flex-col gap-1">
              <Badge variant="destructive" className="self-start">
                {hc.wrongLevel(child.level, "goal")}
              </Badge>
              <FunctionalGoalCard
                node={child}
                activeFilters={activeFilters}
                strategicGoals={pillars.flatMap((p) => p.children)}
              />
            </div>
          )
        ))}
        <AddLevelRow
          level="objective"
          placeholder={hc.addNamePlaceholder}
          onAdd={handleAddStrategic}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => {
        setConfirmOpen(open);
        if (!open) setDeleteReason("");
      }}>
        <AlertDialogContent data-cartograph-region="delete-goal">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {node.name}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div>The file stays in the vault and the item can be recovered.</div>
              <div>
                <Label htmlFor="pillar-delete-reason" className="text-xs">Reason for removal</Label>
                <Input
                  id="pillar-delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Why is this being removed?"
                  className="mt-1"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{hc.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!deleteReason.trim()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteRefusal !== null} onOpenChange={(open) => !open && setDeleteRefusal(null)}>
        <AlertDialogContent data-cartograph-region="delete-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>{hc.deleteBlockedTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {hc.deleteBlockedBody}
              <ul className="mt-2 list-disc pl-5">
                {(deleteRefusal ?? []).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteRefusal(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renameError !== null} onOpenChange={(open) => !open && setRenameError(null)}>
        <AlertDialogContent data-cartograph-region="rename-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to rename goal</AlertDialogTitle>
            <AlertDialogDescription>
              The rename operation could not be saved.
              {renameError && renameError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {renameError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRenameError(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={moveError !== null} onOpenChange={(open) => !open && setMoveError(null)}>
        <AlertDialogContent data-cartograph-region="move-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to move goal</AlertDialogTitle>
            <AlertDialogDescription>
              The move operation could not be saved.
              {moveError && moveError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {moveError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMoveError(null)}>{hc.cancel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={addError !== null} onOpenChange={(open) => !open && setAddError(null)}>
        <AlertDialogContent data-cartograph-region="add-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to add goal</AlertDialogTitle>
            <AlertDialogDescription>
              The goal could not be added.
              {addError && addError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {addError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAddError(null)}>Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UnalignedTray() {
  const client = useClient();
  const projectsQuery = useQuery({
    queryKey: ["sheet-ref-options", "Project"],
    queryFn: () => client.list("Project"),
  });
  const projects = projectsQuery.data ?? [];
  const refQueries = useQueries({ queries: projects.map((p) => projectReferencesQueryOptions(client, p.id)) });

  // A component serves the goals of the project it is part of (TAXONOMY.md
  // D15), so it is never unaligned for naming none of its own.
  const unaligned = projects.filter((_, i) => {
    const refs = refQueries[i]?.data;
    if (!refs) return false;
    const component = refs.outgoing.some((r) => r.kind === "Project" && r.path?.startsWith("/spec/alignment/partOf"));
    return !component && !refs.outgoing.some((r) => r.kind === "Goal");
  });

  if (projectsQuery.isLoading || unaligned.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-4" data-cartograph-region="unaligned">
      <Badge variant="outline">{hc.unalignedTitle}</Badge>
      {unaligned.slice(0, 6).map((p) => (
        <Badge key={p.id} variant="secondary" className="max-w-56 min-w-0 justify-start">
          <span className="truncate">{p.name}</span>
        </Badge>
      ))}
      {unaligned.length > 6 ? <Badge variant="outline">{hc.moreChips(unaligned.length - 6)}</Badge> : null}
      <p className="text-sm text-muted-foreground">{hc.unalignedCount(unaligned.length)}</p>
    </div>
  );
}

export function GoalsHome() {
  const queryClient = useQueryClient();
  const client = useClient();
  const treeQuery = useGoalTree();
  const [activeFilters, setActiveFilters] = useState<Set<AlignKind>>(new Set());
  const [addError, setAddError] = useState<{ path: string; message: string }[] | null>(null);

  const nodes = useMemo(() => treeQuery.data?.nodes ?? [], [treeQuery.data]);
  const pillars = nodes;

  function toggleFilter(kind: AlignKind) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  async function handleAddPillar(name: string) {
    const id = slugify(name);
    if (!id) return;
    const result = await createGoal(client, id, name, "goal");
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    } else if (result.conflict) {
      setAddError([{ path: "name", message: "A goal with this name already exists. Rename the other goal or choose another name." }]);
    } else {
      setAddError(result.problems);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{hc.title}</h1>
          <p className="text-muted-foreground">{hc.subtitle}</p>
          {/* The three levels, each defined behind its "?" (TAXONOMY.md D29). */}
          <ul className="mt-2 flex flex-wrap items-center gap-3 text-sm" aria-label={hc.levelsLegend} data-slot="level-legend">
            {(["goal", "objective", "outcome"] as const).map((level) => (
              <li key={level} className="flex items-center gap-1">
                <LevelMarkTag level={level} />
                <span>{levelName(level, treeQuery.data?.levels)}</span>
                <Term word={level} />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALIGN_KINDS.map((k) => (
            <Badge key={k} asChild variant={activeFilters.has(k) ? "current" : "outline"}>
              <button
                type="button"
                className="cursor-pointer select-none"
                aria-pressed={activeFilters.has(k)}
                onClick={() => toggleFilter(k)}
              >
                {hc.filters[KIND_TO_FILTER[k]]}
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {treeQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : null}
      {treeQuery.isError ? <ErrorAlert message={hc.error} onRetry={() => treeQuery.refetch()} /> : null}

      {!treeQuery.isLoading && !treeQuery.isError && nodes.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">
            {hc.emptyTitle} {hc.emptySubtitle}
          </p>
          <div className="w-64">
            <AddLevelRow level="goal" placeholder={hc.addPillarNamePlaceholder} onAdd={handleAddPillar} />
          </div>
        </div>
      ) : null}

      {nodes.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" data-cartograph-region="goal-tree">
          {nodes.map((n) => (
            <PillarColumn key={n.id} node={n} activeFilters={activeFilters} pillars={pillars} />
          ))}
          <div className="flex flex-col gap-3">
            <div className="h-9" />
            <div className="ml-2 border-l pl-4">
              <AddLevelRow level="goal" placeholder={hc.addPillarNamePlaceholder} onAdd={handleAddPillar} />
            </div>
          </div>
        </div>
      ) : null}

      {nodes.length > 0 ? <UnalignedTray /> : null}

      <AlertDialog open={addError !== null} onOpenChange={(open) => !open && setAddError(null)}>
        <AlertDialogContent data-cartograph-region="add-refused">
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to add goal</AlertDialogTitle>
            <AlertDialogDescription>
              The goal could not be added.
              {addError && addError.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {addError.map((p, i) => (
                    <li key={i}>
                      {p.path}: {p.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAddError(null)}>Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
