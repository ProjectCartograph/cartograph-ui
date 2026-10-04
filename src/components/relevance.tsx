import { useEffect, useState, type ReactNode } from "react";
import { Check, Plus, Sparkles, Type } from "lucide-react";

import type { Match } from "@/client/port";
import { copy } from "@/copy";
import { useRelevant, WorkText } from "./useRelevant";

/**
 * What the work on screen is about, in its own words so far (its name,
 * what it is about, its problems and objectives), for every picker inside
 * to rank the workspace against (engine docs/adr/0023). Settles a moment
 * after the typing does, so a suggestion is not asked for at every key.
 */
export function WorkTextProvider({ text, children }: { text: string; children: ReactNode }) {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const t = setTimeout(() => setSettled(text), 600);
    return () => clearTimeout(t);
  }, [text]);
  return <WorkText.Provider value={settled.slice(0, 2000)}>{children}</WorkText.Provider>;
}

/**
 * A short row of what the workspace holds that is relevant to the work,
 * above the picker it belongs to: put first, never chosen. Picking one does
 * what picking it below would; what is already picked shows as picked.
 * Nothing shows until there is enough written to rank against.
 */
export function Suggested({
  kind,
  level,
  selected,
  onPick,
  exclude,
}: {
  kind: string;
  level?: string;
  selected: string[];
  onPick: (id: string) => void;
  /** Ids not to offer, such as the record itself. */
  exclude?: (m: Match) => boolean;
}) {
  const { matches, byModel } = useRelevant(kind, level);
  const shown = matches.filter((m) => !exclude?.(m));
  if (shown.length === 0) return null;
  const Mark = byModel ? Sparkles : Type;
  return (
    <div className="flex flex-col gap-1.5 animate-in fade-in duration-200" data-slot="suggested" data-kind={kind}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Mark className="size-3.5" aria-hidden="true" />
        {byModel ? copy.common.suggested : copy.common.suggestedByWords}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((m) => {
          const on = selected.includes(m.id);
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m.id)}
                aria-pressed={on}
                data-suggestion={m.id}
                className={`inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-sm ring-1 transition-colors duration-150 ease-standard active:scale-[0.98] ${
                  on ? "bg-primary/10 font-medium text-primary ring-primary/30" : "bg-background ring-foreground/15 hover:bg-muted"
                }`}
              >
                {on ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : <Plus className="size-3.5 shrink-0" aria-hidden="true" />}
                <span className="truncate">{m.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
