import { ArrowDown, ArrowRight, ArrowUp, Equal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { keyResultNumber } from "./sentence";
import { isKnownBaseline, type KeyResult } from "./types";

const c = copy.goals.editor.keyResults;

const DIRECTION_ICON = {
  increase: ArrowUp,
  decrease: ArrowDown,
  reach: ArrowRight,
  maintain: Equal,
} as const;

function baselineText(kr: KeyResult): string {
  if (isKnownBaseline(kr.baseline)) {
    return `${keyResultNumber(kr.kind, kr.baseline.value)} in ${kr.baseline.date}`;
  }
  if (kr.baseline) {
    const expected = kr.baseline.expectedBy ? `, expected by ${kr.baseline.expectedBy}` : "";
    return `${c.unknown} (${kr.baseline.unknownReason}${expected})`;
  }
  return c.unknown;
}

function targetText(kr: KeyResult): string {
  if (kr.target) {
    return `${keyResultNumber(kr.kind, kr.target.value)} by ${kr.target.date}`;
  }
  return c.unknown;
}

export function KeyResultCard({
  kr,
  sourceLabel,
  onEdit,
  onRemove,
}: {
  kr: KeyResult;
  sourceLabel?: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const Icon = DIRECTION_ICON[kr.direction];
  const baselineKnown = isKnownBaseline(kr.baseline);
  const targetKnown = !!kr.target;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" data-cartograph-region={`key-result-${kr.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {/* The direction, then what is measured, as the parts they are:
              nothing is assembled into a sentence (TAXONOMY.md D19). */}
          <p className="min-w-0 flex-1 text-sm text-pretty" data-slot="kr-statement">
            <span className="text-muted-foreground">{copy.goals.keyResultDialog.direction[kr.direction] ?? kr.direction}</span>{" "}
            <span className="first-letter:uppercase">{kr.metric}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            {c.edit}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            {c.remove}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 pl-6 text-xs text-muted-foreground">
        <span className={baselineKnown ? "" : "rounded border border-dashed px-1.5 py-0.5"}>
          {baselineText(kr)}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span className={targetKnown ? "" : "rounded border border-dashed px-1.5 py-0.5"}>
          {targetText(kr)}
        </span>
      </div>
      {sourceLabel ? <p className="pl-6 text-xs text-muted-foreground">{sourceLabel}</p> : null}
    </div>
  );
}
