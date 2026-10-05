import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ArrowUp, CircleDot, Sparkles, Type } from "lucide-react";

import { useClient } from "@/client/context";
import type { Match, Order, Understanding } from "@/client/port";
import { entryFor, termOf, useGlossary } from "@/components/glossary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy";
import { manifestLink } from "@/proposals/links";
import { FLOW_KEYS, flowLink, nameFrom } from "./flows";
import { onboarded, useNewWorkspace } from "@/onboarding/firstRun";
import { LeftToDo } from "./LeftToDo";

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
 * and the flows likeliest to define it are offered, so the next step is
 * one choice: open what already says it, or define it in the flow that
 * fits, which opens with what was typed. Without a decision model, what
 * shares its words is shown and every flow is offered.
 */
export function Home() {
  const client = useClient();
  const [text, setText] = useState("");
  const read = useMutation({ mutationFn: (t: string) => client.understand(t) });
  const order = useQuery({ queryKey: ["order"], queryFn: () => client.order() });
  const next = order.data?.stages.find((s) => s.key === order.data?.next);
  // A workspace with nothing in it opens by walking its organisation and
  // strategy, once per browser (src/onboarding).
  const isNew = useNewWorkspace();
  const navigate = useNavigate();
  useEffect(() => {
    if (isNew && !onboarded()) void navigate({ to: "/welcome", replace: true });
  }, [isNew, navigate]);

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
        <Answer key={read.submittedAt} u={read.data} name={nameFrom(read.variables ?? "")} order={order.data} />
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
      {/* What was started and not finished, while nothing is being asked. */}
      {read.data || read.isPending ? null : <LeftToDo />}
    </div>
  );
}

/** What already says it, and where to define it: the record that says
 * it, opened, or the flows likeliest to define it, each opening with what
 * was typed. The person chooses the flow; the model only orders them. */
function Answer({ u, name, order }: { u: Understanding; name: string; order: Order | undefined }) {
  const strong = u.matches.find((m) => m.by === "model");
  const offered = u.routes.map((r) => r.key);
  const rest = FLOW_KEYS.filter((k) => !offered.includes(k));
  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10 animate-in fade-in slide-in-from-bottom-2 duration-250 ease-enter" data-cartograph-region="home-answer">
      {u.matches.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{u.available ? hc.already : hc.sameWords}</p>
          <ul className="flex flex-col">
            {u.matches.map((m) => (
              <MatchRow key={`${m.kind}/${m.id}`} m={m} />
            ))}
          </ul>
          {strong ? (
            <div className="flex min-w-0">
              <OpenButton m={strong} />
            </div>
          ) : null}
        </div>
      ) : u.available ? (
        <p className="text-sm text-muted-foreground">{hc.nothing}</p>
      ) : null}

      <div className="flex flex-col gap-2" data-slot="define-as">
        <div>
          <p className="text-sm font-semibold">{strong ? hc.defineNew : hc.defineAs}</p>
          <p className="text-xs text-muted-foreground">{u.routes.length ? hc.defineAsHint : hc.defineAsNoModel}</p>
        </div>
        {u.routes.length ? (
          <ul className="flex flex-col gap-2" data-slot="flows">
            {u.routes.map((r) => (
              <li key={r.key}>
                <FlowCard stageKey={r.key} name={name} order={order} />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col gap-1.5">
          {u.routes.length ? <p className="text-xs text-muted-foreground">{hc.somethingElse}</p> : null}
          <ul className="flex flex-wrap gap-1.5" aria-label={hc.somethingElse}>
            {(u.routes.length ? rest : FLOW_KEYS).map((k) => (
              <li key={k}>
                <FlowChip stageKey={k} name={name} next={order?.next === k} />
              </li>
            ))}
          </ul>
        </div>
        <Link to="/new" className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {hc.notSure}
        </Link>
      </div>
    </section>
  );
}

/** A flow offered for what was typed: its word, what it is, and where it
 * stands in the order of work. */
function FlowCard({ stageKey, name, order }: { stageKey: string; name: string; order: Order | undefined }) {
  const glossary = useGlossary();
  const entry = entryFor(glossary.data, stageKey);
  const stage = order?.stages.find((s) => s.key === stageKey);
  const waiting = stage?.state === "waiting" && stage.waiting?.length ? stage.waiting.map((k) => termOf(k).toLowerCase()).join(" and ") : "";
  const target = flowLink(stageKey, name);
  return (
    <Link
      to={target.to as never}
      search={target.search as never}
      data-flow={stageKey}
      className="group flex items-center gap-3 rounded-xl bg-background p-3 ring-1 ring-foreground/10 transition-[background-color,box-shadow,transform] duration-150 ease-standard hover:bg-muted/60 hover:ring-foreground/20 active:scale-[0.99]"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{termOf(stageKey)}</span>
        {entry ? <span className="text-sm text-muted-foreground">{entry.summary}</span> : null}
        {waiting ? <span className="text-xs text-muted-foreground">{hc.needsFirst(waiting)}</span> : null}
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-standard group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

function FlowChip({ stageKey, name, next }: { stageKey: string; name: string; next: boolean }) {
  const target = flowLink(stageKey, name);
  return (
    <Link
      to={target.to as never}
      search={target.search as never}
      data-flow={stageKey}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ring-1 transition-colors duration-150 ease-standard hover:bg-muted active:bg-muted ${next ? "ring-foreground/30 font-medium" : "ring-foreground/10 text-muted-foreground"}`}
    >
      {next ? <CircleDot className="size-3.5" aria-hidden="true" /> : null}
      {termOf(stageKey)}
    </Link>
  );
}

function MatchRow({ m }: { m: Match }) {
  const link = manifestLink({ kind: m.kind, manifestId: m.id });
  const Mark = m.by === "model" ? Sparkles : Type;
  const by = m.by === "model" ? hc.byMeaning : hc.byWords;
  // The whole row opens the record, so the name keeps the width; on a
  // narrow screen how it matched is its mark alone.
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 font-medium">{m.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {termOf(wordOf(m.kind, m.level))}
          {m.detail ? `: ${m.detail}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={by}>
        <Mark className="size-3.5" aria-label={by} />
        <span className="hidden sm:inline" aria-hidden="true">
          {by}
        </span>
      </span>
    </>
  );
  const row = "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm";
  return (
    <li data-match={`${m.kind}/${m.id}`}>
      {link ? (
        <Link to={link.to as never} params={link.params as never} className={`${row} transition-colors duration-150 ease-standard hover:bg-muted/60 active:bg-muted`}>
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

function OpenButton({ m }: { m: Match }) {
  const link = manifestLink({ kind: m.kind, manifestId: m.id });
  if (!link) return null;
  // A long name shortens rather than running past the card.
  return (
    <Button asChild className="max-w-full">
      <Link to={link.to as never} params={link.params as never}>
        <span className="min-w-0 truncate">
          {hc.open} {m.name}
        </span>
        <ArrowRight />
      </Link>
    </Button>
  );
}
