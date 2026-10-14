import { ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { useProjectStore } from "../store";
import type { Constraint, ImpactLikelihood, Risk } from "../types";
import { newRiskOn } from "./triangle";

const tc = copy.projects.triangle;
const rc = copy.projects.risks;
const LEVELS = ["low", "medium", "high"] as const;

function suffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Whether a risk is placed at this point: on the item, or on the line. */
function placedAt(r: Risk, side: Constraint, on?: string, scopeLine?: string): boolean {
  if (scopeLine) return r.scopeLine === scopeLine;
  return !!on && (r.affects ?? []).some((a) => a.constraint === side && a.on === on);
}

/**
 * The risk question of one item, asked beside it (#59): what happens if
 * this milestone is missed, how the scope could creep across this line,
 * what could keep this deliverable from being delivered, what could make
 * this cost more. Risks are cross-cutting (engine TAXONOMY.md D60, D62):
 * each is declared once, in the register, and raised here where its
 * consequence is decided, placed on the side and the item it bears on.
 */
export function RiskPrompt({ side, on, scopeLine, question, short }: { side: Constraint; on?: string; scopeLine?: string; question: string; short: string }) {
  const store = useProjectStore();
  const here = (store.spec.risks ?? []).filter((r) => placedAt(r, side, on, scopeLine));
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [likelihood, setLikelihood] = useState<ImpactLikelihood | "">("");
  const [impact, setImpact] = useState<ImpactLikelihood | "">("");

  function add() {
    const text = description.trim();
    if (!text) return;
    const risk: Risk = { ...newRiskOn(`r-${suffix()}`, text.slice(0, 160), side, impact || undefined, on), ...(likelihood ? { likelihood } : {}), ...(scopeLine ? { scopeLine } : {}) };
    store.updateSpec((s) => ({ ...s, risks: [...(s.risks ?? []), risk] }));
    setDescription("");
    setLikelihood("");
    setImpact("");
    setAdding(false);
    setOpen(true);
  }

  return (
    <div className="flex flex-col gap-1.5" data-cartograph-region={`risk-prompt-${side}`}>
      <div className="flex flex-wrap items-center gap-2">
        {here.length > 0 ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs text-warning">
            <ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {tc.promptCount(here.length)}
          </button>
        ) : null}
        {!adding ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setAdding(true)} aria-label={question} title={question}>
            <Plus />
            {short}
          </Button>
        ) : null}
      </div>
      {open && here.length > 0 ? (
        <ul className="flex flex-col gap-0.5 pl-5 text-sm">
          {here.map((r, i) => (
            <li key={r.id ?? i} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-pretty">{r.description || rc.unnamed}</span>
              {r.likelihood ? <span className="text-xs text-muted-foreground">{rc.levels[r.likelihood]}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {question}
            <Input
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
                if (e.key === "Escape") setAdding(false);
              }}
              maxLength={160}
              className="text-sm text-foreground"
              data-cartograph-field="/spec/risks/-/description"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            {(
              [
                [tc.promptLikelihood, likelihood, setLikelihood, "/spec/risks/-/likelihood"],
                [tc.promptImpact(tc.sides[side]), impact, setImpact, "/spec/risks/-/affects/-/impact"],
              ] as const
            ).map(([label, value, set, field]) => (
              <label key={field} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {label}
                <Select value={value} onValueChange={(v) => set(v as ImpactLikelihood)}>
                  <SelectTrigger className="w-32" aria-label={label} data-cartograph-field={field}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {rc.levels[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ))}
            <Button type="button" size="sm" onClick={add} disabled={!description.trim()}>
              {tc.hereSave}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {tc.hereCancel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
