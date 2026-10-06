import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldHeading } from "@/components/guidance";
import { copy, plusNoun } from "@/copy";
import { RefObjectField, type RefValue } from "@/surfaces/sheet/RefObjectField";

/**
 * The bodies and roles a matter goes up through when it cannot be settled
 * at this level, nearest first (TAXONOMY.md D44): each a governance body
 * or role from the catalogue, or a body outside the workspace by name.
 * One editor for a project and a programme.
 */
type Step = NonNullable<RefValue>;

export function EscalationRoute({ value, onChange }: { value: Step[]; onChange: (next: Step[] | undefined) => void }) {
  const c = copy.escalationRoute;
  const set = (next: Step[]) => onChange(next.length > 0 ? next : undefined);
  return (
    <div className="flex flex-col gap-2" data-cartograph-region="escalation-route">
      <FieldHeading label={c.label} hint={c.hint} />
      {value.length === 0 ? <p className="text-sm text-muted-foreground">{c.empty}</p> : null}
      <ol className="flex flex-col gap-2">
        {value.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <RefObjectField pointer={`/spec/escalationRoute/${i}`} value={r} onChange={(next) => set(value.map((x, j) => (j === i ? (next ?? {}) : x)))} />
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => set(value.filter((_, j) => j !== i))} aria-label={copy.projects.common.remove}>
              <X />
            </Button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" className="self-start border-dashed" onClick={() => set([...value, {}])} aria-label={c.add}>
        <Plus />
        {plusNoun(c.add)}
      </Button>
    </div>
  );
}
