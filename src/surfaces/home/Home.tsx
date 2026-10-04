import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUp, CircleDot, Sparkles, Type } from "lucide-react";

import { useClient } from "@/client/context";
import type { Match, Understanding } from "@/client/port";
import { termOf } from "@/components/glossary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { manifestLink } from "@/proposals/links";

const hc = copy.home;

/** A record's word in the glossary, from its kind and level. */
function wordOf(kind: string, level?: string): string {
  if (level) return level;
  const keys: Record<string, string> = { KPI: "kpi", StakeholderMap: "stakeholders", Purpose: "purpose", Gap: "gap", Assumption: "assumption", Programme: "programme", Operation: "operation", Project: "project" };
  return keys[kind] ?? kind;
}

/**
 * Home: one question, as a conversation would start, answered by reading
 * rather than writing (engine docs/adr/0023). What a person types is
 * matched against the record, each existing record asked of on its own,
 * so they are led to the next step: open what already says it, or define
 * something new, where New's questions say what it is. Without a decision
 * model, what shares its words is shown.
 */
export function Home() {
  const client = useClient();
  const [text, setText] = useState("");
  const read = useMutation({ mutationFn: (t: string) => client.understand(t) });
  const order = useQuery({ queryKey: ["order"], queryFn: () => client.order() });
  const next = order.data?.stages.find((s) => s.key === order.data?.next);

  function submit() {
    const t = text.trim();
    if (t) read.mutate(t);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-[12vh] pb-12" data-cartograph-region="home">
      <h1 className="text-center text-3xl font-semibold tracking-tight">{hc.title}</h1>
      <form
        className="flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10 transition-shadow duration-150 ease-standard focus-within:shadow-md focus-within:ring-foreground/20"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          aria-label={hc.title}
          placeholder={hc.placeholder}
          rows={3}
          autoFocus
          className="min-h-20 resize-none border-0 bg-transparent p-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          data-cartograph-field="home"
        />
        <div className="flex items-center justify-end">
          <Button type="submit" size="icon" aria-label={hc.ask} title={hc.ask} disabled={!text.trim() || read.isPending}>
            <ArrowUp />
          </Button>
        </div>
      </form>

      {read.isPending ? (
        <p className="text-center text-sm text-muted-foreground animate-in fade-in duration-150" role="status">
          {hc.reading}
        </p>
      ) : read.data ? (
        <Answer key={read.submittedAt} u={read.data} />
      ) : next ? (
        <Link
          to="/new"
          className="flex items-center gap-3 self-center rounded-full px-4 py-2 text-sm text-muted-foreground ring-1 ring-foreground/10 transition-colors duration-150 ease-standard hover:bg-muted active:bg-muted"
          data-slot="home-next"
        >
          <CircleDot className="size-4" aria-hidden="true" />
          {hc.next}: <span className="font-medium text-foreground">{termOf(next.key)}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

/** What already says it, and the one next step: open the record that
 * says it, or define something new through New's questions. */
function Answer({ u }: { u: Understanding }) {
  const strong = u.matches.find((m) => m.by === "model" && m.likelihood >= 0.6);
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 animate-in fade-in slide-in-from-bottom-2 duration-250 ease-enter" data-cartograph-region="home-answer">
      {u.matches.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{u.available ? hc.already : hc.sameWords}</p>
          <ul className="flex flex-col">
            {u.matches.map((m) => (
              <MatchRow key={`${m.kind}/${m.id}`} m={m} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{hc.nothing}</p>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {strong ? <OpenButton m={strong} /> : null}
          <Button asChild variant={strong ? "ghost" : "default"}>
            <Link to="/new">
              {hc.defineNew}
              {strong ? null : <ArrowRight />}
            </Link>
          </Button>
        </div>
        {strong ? null : <p className="text-xs text-muted-foreground">{hc.defineHint}</p>}
      </div>
    </section>
  );
}

function MatchRow({ m }: { m: Match }) {
  const link = manifestLink({ kind: m.kind, manifestId: m.id });
  const Mark = m.by === "model" ? Sparkles : Type;
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 ease-standard hover:bg-muted/60" data-match={`${m.kind}/${m.id}`}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{m.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {termOf(wordOf(m.kind, m.level))}
          {m.detail ? `: ${m.detail}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={m.by === "model" ? hc.byMeaning : hc.byWords}>
        <Mark className="size-3.5" aria-hidden="true" />
        {m.by === "model" ? hc.byMeaning : hc.byWords}
      </span>
      {link ? (
        <Button asChild size="sm" variant="ghost">
          <Link to={link.to as never} params={link.params as never}>
            {hc.open}
          </Link>
        </Button>
      ) : null}
    </li>
  );
}

function OpenButton({ m }: { m: Match }) {
  const link = manifestLink({ kind: m.kind, manifestId: m.id });
  if (!link) return null;
  return (
    <Button asChild>
      <Link to={link.to as never} params={link.params as never}>
        {hc.open} {m.name}
        <ArrowRight />
      </Link>
    </Button>
  );
}
