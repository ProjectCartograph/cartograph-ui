import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Zap } from "lucide-react";

import { useClient } from "@/client/context";
import type { Happened, WaitsNode } from "@/client/port";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { monthWords } from "./canvas/waits";
import { useProjectStore } from "./store";
import type { ProjectEvent } from "./types";

const wh = copy.projects.whatHappened;
const ac = copy.projects.approval;

/** What can follow, on an item a trigger reaches, as the event log names
 * it; a KPI's target or another project's item changes in its own record. */
const FOLLOWS: Record<string, ProjectEvent["happened"][]> = {
  milestones: ["slipped", "reached"],
  deliverables: ["slipped", "rejected"],
  conditions: ["notMet"],
  procurement: ["slipped"],
  risks: ["occurred"],
};

const today = () => new Date().toISOString().slice(0, 10);

/** The key a reached item is known by on the waits map. */
export function reachKey(n: Pick<WaitsNode, "record" | "item" | "kind">): string {
  return `${n.record.kind}/${n.record.id}#${n.item ?? n.kind}`;
}

/**
 * Something happened, in the person's own words (engine TAXONOMY.md D59):
 * the decision model finds the item it happened to, the person confirms
 * it and what happened, sees every item it reaches, marked on the waits
 * map too, and records the event and what follows from it in one edit,
 * each follow-on naming the event as its cause.
 */
export function WhatHappened() {
  const store = useProjectStore();
  const client = useClient();
  const queries = useQueryClient();
  const [text, setText] = useState("");
  const [found, setFound] = useState<Happened | undefined>();
  const [item, setItem] = useState<string | undefined>();
  const [happened, setHappened] = useState<ProjectEvent["happened"] | undefined>();
  const [date, setDate] = useState(today());
  const [reach, setReach] = useState<WaitsNode[]>([]);
  const [follow, setFollow] = useState<Record<string, ProjectEvent["happened"] | "">>({});
  const [busy, setBusy] = useState(false);

  async function find() {
    setBusy(true);
    try {
      setFound(await client.whatHappened(store.id, text));
      setItem(undefined);
      setReach([]);
    } finally {
      setBusy(false);
    }
  }
  async function pick(next: string) {
    setItem(next);
    setHappened(found?.matches.find((m) => m.item === next)?.happens[0] as ProjectEvent["happened"]);
    const reached = await client.affects(store.id, next);
    setReach(reached);
    setFollow({});
    // The waits map marks what this reaches.
    queries.setQueryData(["waits-reach", store.id], reached.map(reachKey));
  }
  function record() {
    if (!item || !happened) return;
    const [list, id] = item.split("/");
    store.updateSpec((s) => {
      const events = [...(s.events ?? [])];
      const add = (e: Omit<ProjectEvent, "id">) => {
        let n = events.length + 1;
        while (events.some((x) => x.id === `e${n}`)) n++;
        events.push({ id: `e${n}`, ...e });
        return `e${n}`;
      };
      const cause = add({ on: { local: list as "milestones", id }, happened, date, ...(text.trim() ? { note: text.trim().slice(0, 400) } : {}) });
      for (const n of reach) {
        const verb = follow[reachKey(n)];
        if (!verb || n.record.kind !== "Project" || n.record.id !== store.id || !n.item) continue;
        const [l, i] = n.item.split("/");
        add({ on: { local: l as "milestones", id: i }, happened: verb, date, cause });
      }
      return { ...s, events };
    });
    queries.setQueryData(["waits-reach", store.id], []);
    setText("");
    setFound(undefined);
    setItem(undefined);
    setReach([]);
  }

  const chosen = found?.matches.find((m) => m.item === item);
  return (
    <section className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10" data-slot="what-happened" aria-labelledby="what-happened-title">
      <div className="flex items-center gap-2">
        <Zap className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 id="what-happened-title" className="text-sm font-semibold">
          {wh.title}
        </h3>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {wh.textLabel}
        <Textarea value={text} maxLength={400} onChange={(e) => setText(e.target.value)} className="min-h-16 text-sm" />
      </label>
      <Button type="button" size="sm" className="self-start" disabled={!text.trim() || busy} onClick={() => void find()} aria-label={wh.find}>
        <Search />
        {wh.findShort}
      </Button>
      {found ? (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={wh.itemLabel}>
          <p className="text-xs text-muted-foreground">{found.available ? wh.ranked : wh.unranked}</p>
          {found.matches.length === 0 ? <p className="text-sm text-muted-foreground">{wh.none}</p> : null}
          {found.matches.map((m) => (
            <button
              key={m.item}
              type="button"
              role="radio"
              aria-checked={item === m.item}
              onClick={() => void pick(m.item)}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-left text-sm transition-colors duration-150 ${item === m.item ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
              data-happened-item={m.item}
            >
              <span className="min-w-0 truncate">{m.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{wh.kinds[m.kind]}</span>
            </button>
          ))}
        </div>
      ) : null}
      {chosen ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={happened} onValueChange={(v) => setHappened(v as ProjectEvent["happened"])}>
              <SelectTrigger className="h-8 w-40" aria-label={ac.happened}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chosen.happens.map((h) => (
                  <SelectItem key={h} value={h}>
                    {ac.happenedWords[h] ?? h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" className="h-8 w-40" value={date} onChange={(e) => setDate(e.target.value)} aria-label={wh.dateLabel} />
          </div>
          <p className="text-xs font-medium">{reach.length > 0 ? wh.reaches(reach.length) : wh.reachesNothing}</p>
          <ul className="flex flex-col gap-1.5" aria-label={wh.reachLabel}>
            {reach.map((n) => {
              const own = n.record.kind === "Project" && n.record.id === store.id && n.item;
              const verbs = own ? (FOLLOWS[n.item!.split("/")[0]] ?? []) : [];
              const k = reachKey(n);
              return (
                <li key={k} className="flex flex-wrap items-center gap-2 text-sm" data-reach={k}>
                  <span className="min-w-0 flex-1 truncate">
                    {n.name}
                    {n.month ? <span className="ml-2 text-xs text-muted-foreground">{monthWords(n.month)}</span> : null}
                  </span>
                  {verbs.length > 0 ? (
                    <Select value={follow[k] || "none"} onValueChange={(v) => setFollow({ ...follow, [k]: v === "none" ? "" : (v as ProjectEvent["happened"]) })}>
                      <SelectTrigger className="h-7 w-44" aria-label={wh.followLabel(n.name)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{wh.followNone}</SelectItem>
                        {verbs.map((v) => (
                          <SelectItem key={v} value={v}>
                            {ac.happenedWords[v] ?? v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">{wh.changeThere}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <Button type="button" size="sm" className="self-start" disabled={!happened || !date} onClick={record} aria-label={wh.record}>
            <Zap />
            {wh.recordShort}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
