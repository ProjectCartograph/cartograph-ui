import { useId, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import type { GoalTree } from "@/client/port";
import { DidYouMean } from "@/components/DidYouMean";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copy } from "@/copy";
import { slugify } from "@/surfaces/sheet/schema";
import { GoalTreePicker } from "./GoalTreePicker";
import { levelName } from "./levels";
import { createGoal } from "./mutations";
import type { GoalLevel } from "./types";

const pc = copy.goals.home.place;

const PARENT: Record<GoalLevel, GoalLevel | undefined> = { goal: undefined, objective: "goal", outcome: "objective" };

type Node = GoalTree["nodes"][number];

/** Every goal at a level, placed or not: what something can go under. */
function placesAt(tree: GoalTree | undefined, level: string): Node[] {
  const out: Node[] = [];
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.level === level) out.push(n);
      walk(n.children ?? []);
    }
  };
  walk(tree?.nodes ?? []);
  walk(tree?.unplaced ?? []);
  return out;
}

type Props = {
  level: GoalLevel;
  name: string;
  tree: GoalTree | undefined;
  onDone: (id?: string) => void;
  /** The level is settled by where the person is (a project's outcomes). */
  fixedLevel?: boolean;
};

/**
 * A goal, objective or outcome added with its name, and placed where the
 * tree needs it: under the level above, picked on the tree itself. Where
 * there is nothing at that level yet, the order of work says to define it
 * first (TAXONOMY.md D28), so the parent is added here and the one the
 * person came with follows under it. Either can be left unplaced instead
 * (D35): defined now, placed later.
 *
 * In the page where the person already is, it is a panel of the page
 * (PlaceGoalForm); from a button with nothing around it, a dialog.
 */
export function PlaceGoal(props: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && props.onDone()}>
      <DialogContent data-slot="place-goal" className="sm:max-w-lg">
        <PlaceGoalForm
          {...props}
          frame={({ title, description, children }) => (
            <>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                {description ? <DialogDescription>{description}</DialogDescription> : null}
              </DialogHeader>
              {children}
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}

type Frame = (p: { title: string; description?: string; children: ReactNode }) => ReactNode;

const PanelFrame: Frame = ({ title, description, children }) => (
  <section className="cartograph-arrive flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-new/50" data-slot="place-goal" aria-label={title}>
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {children}
  </section>
);

export function PlaceGoalForm({ level, name, tree, onDone, fixedLevel = false, frame = PanelFrame }: Props & { frame?: Frame }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const ids = useId();
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
  const parents = parentLevel ? placesAt(tree, parentLevel) : [];
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
    // The tree is read again, but the person does not wait on it.
    void queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
    setProblems([]);
    setUnplaced(null);
    if (waiting) {
      // The parent just added, placed or not, is where the waiting one goes.
      setNow({ level: waiting.level, name: waiting.name, parent: id, parentName: trimmed });
      setWaiting(null);
      return;
    }
    onDone(id);
  }

  function parentFirst() {
    if (!parentLevel) return;
    setWaiting({ level: now.level, name: now.name });
    setUnplaced(null);
    setNow({ level: parentLevel, name: "", parent: "", parentName: "" });
  }

  return frame({
    title: pc.title(word(now.level)),
    description: waiting ? pc.then(waiting.name, word(now.level)) : undefined,
    children: (
      <div className="flex flex-col gap-4">
        {/* The level is offered, not settled: the model tells the three
            apart least well (engine docs/adr/0023). Fixed while a parent
            is added for the one waiting. */}
        {waiting || fixedLevel ? null : (
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
          <Label htmlFor={`${ids}-name`}>{pc.name}</Label>
          <Input id={`${ids}-name`} data-cartograph-field="/metadata/name" value={now.name} onChange={(e) => setNow({ ...now, name: e.target.value })} autoFocus />
        </div>
        {/* Already in the tree under another spelling: that one is used,
            and the one waiting on it goes under it. */}
        <DidYouMean
          kind="Goal"
          level={now.level}
          name={now.name}
          onUse={(m) => {
            if (waiting) {
              setNow({ level: waiting.level, name: waiting.name, parent: m.id, parentName: m.name });
              setWaiting(null);
              return;
            }
            onDone(m.id);
          }}
        />
        {parentLevel && now.parentName ? <p className="text-sm text-muted-foreground">{pc.under(word(parentLevel), now.parentName)}</p> : null}
        {parentLevel && unplaced !== null ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm" data-slot="unplaced">
            <Label htmlFor={`${ids}-under`}>{pc.unplacedUnder(word(parentLevel))}</Label>
            <Input id={`${ids}-under`} value={unplaced} onChange={(e) => setUnplaced(e.target.value.slice(0, 120))} />
            <p className="text-muted-foreground">{pc.unplacedNote(word(parentLevel))}</p>
            {!orphan ? (
              <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setUnplaced(null)}>
                {pc.placeInstead}
              </Button>
            ) : null}
          </div>
        ) : null}
        {parentLevel && unplaced === null && !orphan && !now.parentName ? (
          <div className="flex flex-col gap-1.5">
            <Label id={`${ids}-parent`}>{pc.parent(word(parentLevel))}</Label>
            <GoalTreePicker tree={tree} level={now.level} value={parent} onChange={(p) => setNow({ ...now, parent: p })} name={now.name} labelledBy={`${ids}-parent`} />
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
            yet (TAXONOMY.md D35). */}
        {parentLevel && unplaced === null && !now.parentName ? (
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onDone()}>
            {pc.cancel}
          </Button>
          <Button type="button" onClick={() => void add()} disabled={saving || !now.name.trim() || (unplaced === null && (orphan || (!!parentLevel && !parent)))}>
            {pc.add}
          </Button>
        </div>
      </div>
    ),
  });
}
