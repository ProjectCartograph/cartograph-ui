import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useClient } from "@/client/context";
import type { GoalTree } from "@/client/port";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { GoalTreePicker } from "./GoalTreePicker";
import { LevelMarkTag, levelName } from "./levels";
import { moveGoal } from "./mutations";
import type { GoalLevel } from "./types";

const uc = copy.goals.home.unplaced;

type Node = GoalTree["nodes"][number];

/**
 * The objectives and outcomes defined before what they sit under
 * (engine TAXONOMY.md D35): listed apart from the tree, with what is
 * already under them, each placed on the tree in its own row once its
 * parent exists. Placing it ends its placeholder.
 */
export function Unplaced({ tree }: { tree: GoalTree | undefined }) {
  const unplaced = tree?.unplaced ?? [];
  if (unplaced.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dashed border-warning/60 bg-warning/5 p-4" data-cartograph-region="unplaced" aria-labelledby="unplaced-title">
      <div>
        <h2 id="unplaced-title" className="text-sm font-semibold">
          {uc.title}
        </h2>
        <p className="text-sm text-muted-foreground">{uc.hint}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {unplaced.map((n) => (
          <UnplacedRow key={n.id} node={n} tree={tree} />
        ))}
      </ul>
    </section>
  );
}

function UnplacedRow({ node, tree }: { node: Node; tree: GoalTree | undefined }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const [placing, setPlacing] = useState(false);
  const [to, setTo] = useState("");
  const [problem, setProblem] = useState("");
  const above = levelName(node.level === "objective" ? "goal" : "objective", tree?.levels);
  const under = (node.children ?? []).filter((c) => c.level === "outcome");

  async function place() {
    const result = await moveGoal(client, node.id, to);
    if (!result.ok) {
      setProblem(result.problems.map((p) => p.message).join(" "));
      return;
    }
    setPlacing(false);
    await queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
  }

  return (
    <li data-unplaced={node.id} className="cartograph-arrive flex flex-col gap-3 rounded-lg bg-card p-3 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-3">
        <LevelMarkTag level={node.level} />
        <Link to="/goals/$id" params={{ id: node.id }} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
          {node.name}
        </Link>
        {!placing ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setPlacing(true)}>
            {uc.place(above)}
          </Button>
        ) : null}
      </div>
      {under.length > 0 ? (
        <ul className="flex flex-col gap-1 border-l pl-3 text-sm text-muted-foreground" aria-label={uc.under(node.name)}>
          {under.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <LevelMarkTag level={c.level} />
              <span className="truncate">{c.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {placing ? (
        <div className="flex flex-col gap-2" data-slot="place-unplaced">
          <GoalTreePicker tree={tree} level={node.level as GoalLevel} value={to} onChange={setTo} name={node.name} exclude={node.id} />
          {problem ? (
            <p className="text-sm text-destructive" role="alert">
              {problem}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPlacing(false)}>
              {copy.goals.home.place.cancel}
            </Button>
            <Button type="button" size="sm" disabled={!to} onClick={() => void place()}>
              {copy.goals.picker.move}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
