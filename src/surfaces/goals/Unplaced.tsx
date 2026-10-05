import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useClient } from "@/client/context";
import type { GoalTree } from "@/client/port";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { LevelMarkTag, levelName } from "./levels";
import { moveGoal } from "./mutations";

const uc = copy.goals.home.unplaced;

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
 * The objectives and outcomes defined before what they sit under
 * (engine TAXONOMY.md D35): listed apart from the tree, each with a way to
 * place it once its parent exists. Placing it ends its placeholder.
 */
export function Unplaced({ tree }: { tree: GoalTree | undefined }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const unplaced = tree?.unplaced ?? [];
  if (unplaced.length === 0) return null;
  const goals = atLevel(tree?.nodes ?? [], "goal");
  const objectives = atLevel(tree?.nodes ?? [], "objective");

  async function place(id: string, parent: string) {
    const result = await moveGoal(client, id, parent);
    if (result.ok) await queryClient.invalidateQueries({ queryKey: ["goal-tree"] });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dashed border-warning/60 bg-warning/5 p-4" data-cartograph-region="unplaced" aria-labelledby="unplaced-title">
      <div>
        <h2 id="unplaced-title" className="text-sm font-semibold">
          {uc.title}
        </h2>
        <p className="text-sm text-muted-foreground">{uc.hint}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {unplaced.map((n) => {
          const under = n.level === "objective" ? goals : objectives;
          const above = levelName(n.level === "objective" ? "goal" : "objective", tree?.levels);
          return (
            <li key={n.id} data-unplaced={n.id} className="cartograph-arrive flex flex-wrap items-center gap-3 rounded-lg bg-card p-3 ring-1 ring-foreground/10">
              <LevelMarkTag level={n.level} />
              <Link to="/goals/$id" params={{ id: n.id }} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                {n.name}
              </Link>
              {under.length > 0 ? (
                <Select value="" onValueChange={(parent) => void place(n.id, parent)}>
                  <SelectTrigger size="sm" className="w-56" aria-label={uc.place(above)}>
                    <SelectValue placeholder={uc.place(above)} />
                  </SelectTrigger>
                  <SelectContent>
                    {under.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">{uc.noneYet(above)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
