import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { GoalTree } from "@/client/port";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { slugify } from "@/surfaces/sheet/schema";
import { levelName } from "./levels";
import { createGoal } from "./mutations";
import type { GoalLevel } from "./types";

const pc = copy.goals.home.place;

const PARENT: Record<GoalLevel, GoalLevel | undefined> = { goal: undefined, objective: "goal", outcome: "objective" };

type Node = GoalTree["nodes"][number];

function atLevel(nodes: Node[], level: string): Node[] {
  const out: Node[] = [];
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.level === level) out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/**
 * A goal, objective or outcome arriving from the home page with its name
 * (engine docs/adr/0023), placed where the tree needs it: under the level
 * above. Where there is nothing at that level yet, the order of work says
 * to define it first (TAXONOMY.md D28), so the parent is added here, and
 * the one the person came with follows under it.
 */
export function PlaceGoal({ level, name, tree, onDone }: { level: GoalLevel; name: string; tree: GoalTree | undefined; onDone: (id?: string) => void }) {
  const client = useClient();
  const queryClient = useQueryClient();
  // The goal being added now, and the one waiting on it.
  // parentName is set for a parent added here, before the tree has it.
  const [now, setNow] = useState({ level, name, parent: "", parentName: "" });
  const [waiting, setWaiting] = useState<{ level: GoalLevel; name: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Left unplaced (TAXONOMY.md D35): null when it is being placed; else
  // what it would sit under, as far as the person can say.
  const [unplaced, setUnplaced] = useState<string | null>(null);

  const levels = tree?.levels;
  const word = (l: GoalLevel) => levelName(l, levels);
  const parentLevel = PARENT[now.level];
  const parents = parentLevel ? atLevel(tree?.nodes ?? [], parentLevel) : [];
  const orphan = !!parentLevel && parents.length === 0 && !now.parentName;
  // With one place it can go, it goes there.
  const parent = now.parent || (parents.length === 1 ? parents[0].id : "");

  async function add() {
    const trimmed = now.name.trim();
    const id = slugify(trimmed);
    if (!id) return;
    setSaving(true);
    const result = await createGoal(client, id, trimmed, now.level, unplaced === null ? parent || undefined : undefined, unplaced ?? undefined);
    setSaving(false);
    if (!result.ok) {
      setProblems(result.conflict ? [pc.taken] : result.problems.map((p) => p.message));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    setProblems([]);
    if (waiting) {
      setNow({ level: waiting.level, name: waiting.name, parent: id, parentName: trimmed });
      setWaiting(null);
      return;
    }
    onDone(id);
  }

  function parentFirst() {
    if (!parentLevel) return;
    setWaiting({ level: now.level, name: now.name });
    setNow({ level: parentLevel, name: "", parent: "", parentName: "" });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent data-slot="place-goal">
        <DialogHeader>
          <DialogTitle>{pc.title(word(now.level))}</DialogTitle>
          {waiting ? <DialogDescription>{pc.then(waiting.name, word(now.level))}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {/* The level is offered, not settled: the model tells the three
              apart least well (engine docs/adr/0023). Fixed while a parent
              is added for the one waiting. */}
          {waiting ? null : (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={now.level}
              onValueChange={(next) => next && setNow({ level: next as GoalLevel, name: now.name, parent: "", parentName: "" })}
              aria-label={pc.level}
              data-cartograph-field="/spec/level"
            >
              {(["goal", "objective", "outcome"] as const).map((l) => (
                <ToggleGroupItem key={l} value={l}>
                  {word(l)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="place-goal-name">{pc.name}</Label>
            <Input id="place-goal-name" data-cartograph-field="/metadata/name" value={now.name} onChange={(e) => setNow({ ...now, name: e.target.value })} autoFocus />
          </div>
          {parentLevel && now.parentName ? (
            <p className="text-sm text-muted-foreground">{pc.under(word(parentLevel), now.parentName)}</p>
          ) : null}
          {parentLevel && unplaced !== null ? (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm" data-slot="unplaced">
              <Label htmlFor="place-goal-under">{pc.unplacedUnder(word(parentLevel))}</Label>
              <Input id="place-goal-under" value={unplaced} onChange={(e) => setUnplaced(e.target.value.slice(0, 120))} />
              <p className="text-muted-foreground">{pc.unplacedNote(word(parentLevel))}</p>
              <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setUnplaced(null)}>
                {pc.placeInstead}
              </Button>
            </div>
          ) : null}
          {parentLevel && unplaced === null && !orphan && !now.parentName ? (
            <div className="flex flex-col gap-1.5">
              <Label id="place-goal-parent">{pc.parent(word(parentLevel))}</Label>
              <Select value={parent} onValueChange={(parent) => setNow({ ...now, parent })}>
                <SelectTrigger aria-labelledby="place-goal-parent" data-cartograph-field="/spec/parent" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {orphan && parentLevel && unplaced === null ? (
            <div className="flex flex-col items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <p>{pc.none(word(now.level), word(parentLevel))}</p>
              <Button type="button" variant="outline" size="sm" onClick={parentFirst}>
                {pc.first(word(parentLevel))}
              </Button>
            </div>
          ) : null}
          {/* Defined now, placed later: it does not have to fit anywhere
              yet (TAXONOMY.md D35). Not offered for the parent being added
              for one waiting. */}
          {parentLevel && unplaced === null && !now.parentName && !waiting ? (
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setUnplaced("")} data-slot="leave-unplaced">
              {pc.leaveUnplaced}
            </Button>
          ) : null}
          {problems.length ? (
            <ul className="text-sm text-destructive" role="alert">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onDone()}>
            {pc.cancel}
          </Button>
          <Button
            type="button"
            onClick={() => void add()}
            disabled={saving || !now.name.trim() || (unplaced === null && (orphan || (!!parentLevel && !parent)))}
          >
            {pc.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
