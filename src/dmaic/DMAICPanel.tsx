import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";

import { useClient } from "@/client/context";
import type { DMAIC } from "@/client/port";
import { copy } from "@/copy";

const dc = copy.dmaic;

type Phase = DMAIC["phases"][number];

/**
 * Whether the project can be taken through DMAIC (engine TAXONOMY.md D58):
 * the five phases as tiles, each with how many of its tollgate's
 * deliverables the project holds, and the chosen phase's deliverables
 * with where each is held and what is lacking.
 */
export function DMAICPanel({ id }: { id: string }) {
  const client = useClient();
  const q = useQuery({ queryKey: ["dmaic", id], queryFn: () => client.dmaic(id) });
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (q.isLoading) return <p className="text-sm text-muted-foreground">{dc.loading}</p>;
  if (!q.data) return <p className="text-sm text-muted-foreground">{dc.failed}</p>;
  const phases = q.data.phases;
  // The first phase with something lacking is where the eye should go.
  const shown = open ?? phases.find((p) => p.met < p.of)?.phase ?? phases[0]?.phase;
  const phase = phases.find((p) => p.phase === shown);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-cartograph-region="dmaic">
      <div>
        <p className="font-medium">{dc.title}</p>
        <p className="text-sm text-muted-foreground">{dc.hint}</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5" role="tablist" aria-label={dc.title}>
        {phases.map((p) => (
          <PhaseTile key={p.phase} p={p} on={p.phase === shown} onClick={() => setOpen(p.phase)} />
        ))}
      </div>
      {phase ? (
        <ul className="flex flex-col gap-2" data-dmaic-phase={phase.phase}>
          {phase.items.map((it) => (
            <li key={it.key} className="flex items-start gap-2 text-sm" data-dmaic-item={it.key} data-met={it.met}>
              {it.met ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label={dc.met} /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={dc.lacking} />}
              <span className="flex flex-col">
                <span>{it.says}</span>
                {!it.met && it.lacking ? <span className="text-xs text-muted-foreground">{it.lacking}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PhaseTile({ p, on, onClick }: { p: Phase; on: boolean; onClick: () => void }) {
  const done = p.of > 0 && p.met === p.of;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      title={`${dc.phases[p.phase]}: ${dc.count(p.met, p.of)}`}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 ring-1 transition-colors ${on ? "bg-primary/10 ring-primary" : "ring-foreground/10 hover:bg-muted"}`}
      data-dmaic-tile={p.phase}
    >
      <span className={`text-lg font-semibold ${done ? "text-success" : ""}`}>{p.phase[0].toUpperCase()}</span>
      <span className="text-[11px] text-muted-foreground">{dc.phases[p.phase]}</span>
      <span className="text-[11px] tabular-nums">{dc.count(p.met, p.of)}</span>
    </button>
  );
}
