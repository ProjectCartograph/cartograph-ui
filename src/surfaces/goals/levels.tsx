// The one place the three goal levels get their colour and their tag.
// Goals home (the canonical tree) and the project's own aligned-goals
// picker both read from here, so a pillar, a strategic goal and a
// functional goal look the same wherever a person meets them.

import { Badge } from "@/components/ui/badge";
import { vocabIcon } from "@/components/vocab";
import { defaultGoalLevels, type GoalNode } from "./tree-types";
import { useGoalTree } from "./api";
import type { GoalLevel } from "./types";

/**
 * The three tiers are told apart by the mark on their tag, not by colour.
 *
 * Each level used to carry a tint of its own, on the tag and as a wash
 * behind the card. Removed 2026-09-26 (Programme Lead: take the background
 * colours off the Goals cards, keep it clean and consistent with the app
 * overall). Strict shadcn neutral is the rule everywhere else, and the
 * level's own mark already distinguishes the tiers by shape, which is what
 * a person scanning a column actually uses.
 */
export const LEVEL_STYLE: Record<GoalLevel, { tag: string; card: string }> = {
  goal: { tag: "", card: "" },
  objective: { tag: "", card: "" },
  outcome: { tag: "", card: "" },
};

/** The mark for a level, beside its name on every tag: the tiers are
 * told apart by shape as well as by colour, which is what a person
 * scanning a column of cards actually uses. */
function LevelMark({ level, className }: { level: GoalNode["level"]; className?: string }) {
  const Icon = vocabIcon("goalLevel", level);
  return Icon ? <Icon className={`shrink-0 ${className ?? "size-3"}`} aria-hidden="true" /> : null;
}

export function levelStyle(level: GoalNode["level"]): { tag: string; card: string } {
  return LEVEL_STYLE[level as GoalLevel] ?? LEVEL_STYLE.outcome;
}

/** The instance's own name for a level, out of the names the tree itself
 * carries ("Pillar", "Strategic", ...), falling back to the server's own
 * defaults. */
export function levelName(level: GoalNode["level"], levels: string[] | undefined): string {
  const names = levels ?? defaultGoalLevels();
  const index = level === "goal" ? 0 : level === "objective" ? 1 : 2;
  return names[index] ?? level;
}

/** The tier a card belongs to, named as the tree names its levels, so a
 * goal sitting in the wrong place is recognisable at a glance. Pure: the
 * level names are passed in, so a picker can render without a query
 * client of its own. */
export function LevelBadge({ level, levels }: { level: GoalNode["level"]; levels?: string[] }) {
  return (
    <Badge
      variant="outline"
      className={`shrink-0 gap-1 font-normal ${levelStyle(level).tag}`}
      data-slot="level-tag"
    >
      <LevelMark level={level} />
      {levelName(level, levels)}
    </Badge>
  );
}

/**
 * The same tier, as the mark alone.
 *
 * For the goal cards, where the word is a fixed cost on every row and the
 * structure already carries it: pillars are the outer cards, the tier
 * below sits inside them, the one below that inside those. A word that
 * repeats what the nesting says is the case "text is the last resort"
 * covers, and on a vault the size of the Strategic Plan it was taking the
 * width the goal's own name needed (Programme Lead, 2026-09-28).
 *
 * The name is not dropped, only unprinted: it stays the accessible name
 * and the tooltip. It cannot come from the vocab's own words —
 * WORDS.goalLevel is deliberately empty, because a level is named by the
 * instance's tree, not by a fixed string — so it is passed in here.
 */
export function LevelMarkOnly({ level, levels }: { level: GoalNode["level"]; levels?: string[] }) {
  const name = levelName(level, levels);
  return (
    <span
      className="mt-0.5 shrink-0 text-muted-foreground"
      data-slot="level-mark"
      data-level={level}
      aria-label={name}
      title={name}
      role="img"
    >
      <LevelMark level={level} className="size-4" />
    </span>
  );
}

/** LevelBadge, reading the level names from the goal tree itself. */
export function LevelTag({ level }: { level: GoalNode["level"] }) {
  const treeQuery = useGoalTree();
  return <LevelBadge level={level} levels={treeQuery.data?.levels} />;
}

/** LevelMarkOnly, reading the level names from the goal tree itself. */
export function LevelMarkTag({ level }: { level: GoalNode["level"] }) {
  const treeQuery = useGoalTree();
  return <LevelMarkOnly level={level} levels={treeQuery.data?.levels} />;
}
