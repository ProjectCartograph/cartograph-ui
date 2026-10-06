import { CirclePlus, PenLine } from "lucide-react";

import { copy } from "@/copy";

type Proposed = "new" | "changed" | undefined;

/**
 * What the active change set does to a record, where the record shows
 * (engine docs/adr/0024): a small mark beside its name, while the row or
 * card it sits in carries data-proposed for its border. Colour and shape
 * say it at a glance; the label says it to a screen reader and on hover.
 */
export function ProposedMark({ proposed }: { proposed: Proposed }) {
  if (!proposed) return null;
  const label = copy.proposed[proposed];
  const Icon = proposed === "new" ? CirclePlus : PenLine;
  return (
    <Icon
      className={`mt-0.5 size-3.5 shrink-0 ${proposed === "new" ? "text-success" : "text-changed"}`}
      role="img"
      aria-label={label}
      data-slot="proposed-mark"
    >
      <title>{label}</title>
    </Icon>
  );
}
