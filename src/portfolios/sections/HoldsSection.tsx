import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, CirclePause, CircleStop, TrendingUp } from "lucide-react";

import { useClient } from "@/client/context";
import { FieldHeading } from "@/components/guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { copy } from "@/copy";
import { useDefinitionStore } from "@/definition/store";
import { decisionsId, useDecisions, useHeld, type Held } from "../api";
import type { Decision, DecisionLine, PortfolioSpec } from "../types";

const fc = copy.portfolios;
const DECISION_ICON = { invest: TrendingUp, hold: CirclePause, stop: CircleStop } as const;
const ROUTE = { Programme: "/programmes/$id", Project: "/projects/$id", Portfolio: "/portfolios/$id" } as const;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * What the portfolio holds, read back from what names it, and a decision
 * on each: its priority, and whether to invest in it, hold it or stop it
 * (engine TAXONOMY.md D32). The decisions are a file of their own beside
 * the portfolio, saved together as one review.
 */
export function HoldsSection() {
  const store = useDefinitionStore<PortfolioSpec>();
  const client = useClient();
  const queryClient = useQueryClient();
  const held = useHeld(store.id);
  const saved = useDecisions(store.id);
  // The saved decisions until the person changes one; then their edits.
  const [edits, setEdits] = useState<DecisionLine[] | null>(null);
  const lines = edits ?? saved.data ?? [];
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [problems, setProblems] = useState<string[]>([]);

  const lineOf = (h: Held) => lines.find((l) => l.kind === h.kind && l.id === h.id);
  function change(h: Held, patch: Partial<DecisionLine>) {
    setState("idle");
    const prev = lines;
    const at = prev.findIndex((l) => l.kind === h.kind && l.id === h.id);
    const base: DecisionLine = at >= 0 ? prev[at] : { kind: h.kind, id: h.id, decision: "hold" };
    const next = { ...base, ...patch, decidedOn: patch.decision ? today() : base.decidedOn };
    setEdits(at >= 0 ? prev.map((l, i) => (i === at ? next : l)) : [...prev, next]);
  }

  async function save() {
    setState("saving");
    // Only decisions about what the portfolio holds are kept; one about
    // something that no longer names it would be advised on anyway.
    const keep = lines.filter((l) => (held.data ?? []).some((h) => h.kind === l.kind && h.id === l.id));
    const manifest = {
      apiVersion: "cartograph/v1",
      kind: "PortfolioDecisions",
      metadata: { id: decisionsId(store.id), name: fc.decisionsName(store.name || store.id) },
      spec: { portfolio: store.id, decisions: keep },
    };
    try {
      await client.saveVersion("PortfolioDecisions", decisionsId(store.id), manifest, fc.reviewReason);
      setState("saved");
      setProblems([]);
      await queryClient.invalidateQueries({ queryKey: ["portfolio-decisions", store.id] });
      setEdits(null);
      await queryClient.invalidateQueries({ queryKey: ["portfolio-checks", store.id] });
    } catch (e) {
      setState("failed");
      const list = (e as { problems?: { message: string }[] }).problems;
      setProblems(list?.map((p) => p.message) ?? [String(e)]);
    }
  }

  const items = held.data ?? [];
  if (!held.isLoading && items.length === 0) {
    return <p className="max-w-2xl text-sm text-muted-foreground">{fc.holdsEmpty}</p>;
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6" data-cartograph-region="portfolio-holds">
      <p className="text-sm text-muted-foreground">{fc.holdsHint}</p>
      {(["Programme", "Project", "Portfolio"] as const).map((kind) => {
        const ofKind = items.filter((h) => h.kind === kind);
        if (ofKind.length === 0) return null;
        return (
          <div key={kind} className="flex flex-col gap-2">
            <FieldHeading label={fc.kindHeading[kind]} />
            <ul className="flex flex-col gap-2" data-cartograph-field="/spec/decisions">
              {ofKind.map((h) => {
                const line = lineOf(h);
                return (
                  <li key={h.id} data-held={`${h.kind}/${h.id}`} className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
                    <Link to={ROUTE[kind] as never} params={{ id: h.id } as never} className="font-medium underline-offset-4 hover:underline">
                      {h.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={line?.decision ?? ""}
                        onValueChange={(v) => v && change(h, { decision: v as Decision })}
                        aria-label={fc.decision}
                      >
                        {(["invest", "hold", "stop"] as const).map((d) => {
                          const Icon = DECISION_ICON[d];
                          return (
                            <ToggleGroupItem key={d} value={d} className="gap-1.5">
                              <Icon aria-hidden="true" />
                              {fc.decisions[d]}
                            </ToggleGroupItem>
                          );
                        })}
                      </ToggleGroup>
                      <Input
                        type="number"
                        min={1}
                        aria-label={fc.priority}
                        placeholder={fc.priority}
                        className="w-24"
                        value={line?.priority ?? ""}
                        onChange={(e) => change(h, { priority: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : undefined })}
                      />
                      {!line ? <span className="text-xs text-muted-foreground">{fc.undecided}</span> : null}
                    </div>
                    <Input
                      aria-label={fc.reason}
                      placeholder={fc.reason}
                      value={line?.reason ?? ""}
                      maxLength={400}
                      onChange={(e) => change(h, { reason: e.target.value })}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void save()} disabled={state === "saving" || lines.length === 0}>
          {fc.saveDecisions}
        </Button>
        {state === "saved" ? (
          <span className="flex items-center gap-1 text-sm text-muted-foreground animate-in fade-in duration-150" role="status">
            <Check className="size-4" aria-hidden="true" />
            {fc.saved}
          </span>
        ) : null}
      </div>
      {problems.length ? (
        <ul className="text-sm text-destructive" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
