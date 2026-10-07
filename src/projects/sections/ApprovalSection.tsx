import { CheckCheck, FileSignature, History, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { RoleRefPicker, roleOptions, useResourceNames, roleRefLabel } from "../RoleRefPicker";
import { EventPicker, TimingField } from "../TimingField";
import { Labelled } from "../Labelled";
import { useProjectStore, useSectionAutosave } from "../store";
import type { Condition, ProjectEvent, SignOff } from "../types";

const ac = copy.projects.approval;

const today = () => new Date().toISOString().slice(0, 10);

function nextId(prefix: string, taken: { id: string }[]) {
  let n = taken.length + 1;
  while (taken.some((t) => t.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/**
 * Approval (engine TAXONOMY.md D52, D53): the conditions approval
 * carries, the lines that sign the charter, what has happened since, and
 * the parts of the organisation's template held as text. Signing and
 * marking a condition met are events, recorded in the change set like any
 * edit; the engine notes who entered each.
 */
export function ApprovalSection() {
  useSectionAutosave();
  return (
    <div className="flex flex-col gap-8">
      <Conditions />
      <SignOffs />
      <Record />
    </div>
  );
}

function Heading({ icon: Icon, title, hint }: { icon: typeof ListChecks; title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function useEvents() {
  const store = useProjectStore();
  const events = store.spec.events ?? [];
  const record = (e: Omit<ProjectEvent, "id">) =>
    store.updateSpec((s) => {
      const list = s.events ?? [];
      return { ...s, events: [...list, { id: nextId("e", list), ...e }] };
    });
  const last = (local: string, id: string) => [...events].reverse().find((e) => "local" in e.on && e.on.local === local && e.on.id === id);
  return { events, record, last };
}

function Conditions() {
  const store = useProjectStore();
  const names = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], names);
  const list = store.spec.conditions ?? [];
  const { record, last } = useEvents();
  const set = (next: Condition[]) => store.updateSpec((s) => ({ ...s, conditions: next.length > 0 ? next : undefined }));
  const patch = (i: number, p: Partial<Condition>) => set(list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <section className="flex flex-col gap-3" data-cartograph-field="/spec/conditions">
      <Heading icon={ListChecks} title={ac.conditions} hint={ac.conditionsHint} />
      {list.map((c, i) => {
        const met = last("conditions", c.id);
        return (
          <div key={c.id} className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-foreground/10" data-condition={c.id}>
            <div className="flex items-start gap-2">
              <span className="mt-1.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">{i + 1}</span>
              <Textarea
                rows={2}
                value={c.action}
                onChange={(e) => patch(i, { action: e.target.value.slice(0, 240) })}
                maxLength={240}
                aria-label={ac.action}
                className="flex-1"
              />
              {met?.happened === "met" ? (
                <span className="mt-1.5 flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs" title={ac.metOn(met.date)}>
                  <CheckCheck className="size-3.5" aria-hidden="true" />
                  {ac.met}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => record({ on: { local: "conditions", id: c.id }, happened: "met", date: today() })}
                  aria-label={ac.markMet}
                  title={ac.markMet}
                >
                  <CheckCheck />
                  {ac.met}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => set(list.filter((_, j) => j !== i))}
                aria-label={copy.projects.common.remove}
                title={copy.projects.common.remove}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="grid gap-2 pl-8 sm:grid-cols-2">
              <Labelled label={ac.owner}>
                <RoleRefPicker value={c.owner} options={roles} onChange={(owner) => patch(i, { owner })} label={ac.owner} withBodies className="w-full" />
              </Labelled>
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">{ac.gates}</span>
                <EventPicker value={c.gates} onChange={(gates) => patch(i, { gates })} />
              </div>
              <div className="sm:col-span-2">
                <TimingField value={c.due} onChange={(due) => patch(i, { due })} field={`/spec/conditions/${i}/due`} label={ac.due} />
              </div>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => set([...list, { id: nextId("k", list), action: "" }])}
        aria-label={ac.addCondition}
        title={ac.addCondition}
      >
        <Plus />
        {ac.condition}
      </Button>
    </section>
  );
}

const STAGES: SignOff["stage"][] = ["definition", "closing", "handover"];
const DECISIONS = ["approve", "approveWithConditions", "reject"] as const;

function SignOffs() {
  const store = useProjectStore();
  const names = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], names);
  const list = store.spec.signOffs ?? [];
  const { record, last } = useEvents();
  const [deciding, setDeciding] = useState<Record<string, (typeof DECISIONS)[number]>>({});
  const set = (next: SignOff[]) => store.updateSpec((s) => ({ ...s, signOffs: next.length > 0 ? next : undefined }));
  const patch = (i: number, p: Partial<SignOff>) => set(list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <section className="flex flex-col gap-3" data-cartograph-field="/spec/signOffs">
      <Heading icon={FileSignature} title={ac.signOff} hint={ac.signOffHint} />
      {list.length > 0 ? (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2 font-medium">{ac.stage}</th>
                <th className="p-2 font-medium">{ac.line}</th>
                <th className="p-2 font-medium">{ac.role}</th>
                <th className="p-2 font-medium">{ac.signed}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((so, i) => {
                const signed = last("signOffs", so.id);
                return (
                  <tr key={so.id} className="border-t align-top" data-signoff={so.id}>
                    <td className="p-2">
                      <Select value={so.stage} onValueChange={(v) => patch(i, { stage: v as SignOff["stage"] })}>
                        <SelectTrigger className="h-8 w-32" aria-label={ac.stage}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {ac.stages[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-8"
                        value={so.label ?? ""}
                        onChange={(e) => patch(i, { label: e.target.value.slice(0, 80) || undefined })}
                        maxLength={80}
                        aria-label={ac.line}
                      />
                    </td>
                    <td className="min-w-48 p-2">
                      <RoleRefPicker value={so.role} options={roles} onChange={(role) => role && patch(i, { role })} label={ac.role} withBodies className="w-full" />
                    </td>
                    <td className="p-2">
                      {signed ? (
                        <span className="text-xs">
                          {ac.decisions[signed.decision ?? "approve"]}, {signed.date}
                          {signed.recordedBy ? (
                            <span className="block text-muted-foreground">{signed.recordedBy}</span>
                          ) : (
                            <span className="block text-muted-foreground">{ac.mergeToStamp}</span>
                          )}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Select
                            value={deciding[so.id] ?? "approve"}
                            onValueChange={(v) => setDeciding({ ...deciding, [so.id]: v as (typeof DECISIONS)[number] })}
                          >
                            <SelectTrigger className="h-8 w-44" aria-label={ac.decision}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DECISIONS.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {ac.decisions[d]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              record({ on: { local: "signOffs", id: so.id }, happened: "signed", date: today(), decision: deciding[so.id] ?? "approve" })
                            }
                            aria-label={ac.signAs(roleRefLabel(so.role, roles))}
                            title={ac.signAs(roleRefLabel(so.role, roles))}
                          >
                            <FileSignature />
                            {ac.sign}
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => set(list.filter((_, j) => j !== i))}
                        aria-label={copy.projects.common.remove}
                        title={copy.projects.common.remove}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          const sponsor = (store.spec.resources ?? []).find((r) => r.role === "sponsor");
          set([...list, { id: nextId("s", list), stage: "definition", role: sponsor?.id ? { local: "resources", id: sponsor.id } : { external: "" } }]);
        }}
        aria-label={ac.addSignOff}
        title={ac.addSignOff}
      >
        <Plus />
        {ac.signOffLine}
      </Button>
    </section>
  );
}

const HAPPENED: ProjectEvent["happened"][] = ["reached", "slipped", "accepted", "rejected", "met", "notMet", "occurred", "issued", "decided"];

/** What has happened, newest first, and a line to record the next. */
function Record() {
  const store = useProjectStore();
  const s = store.spec;
  const { events, record } = useEvents();
  const [draft, setDraft] = useState<Partial<ProjectEvent>>({ date: today(), happened: "reached" });
  const items: { list: string; label: string; options: { id: string; name: string }[] }[] = [
    { list: "milestones", label: ac.lists.milestones, options: (s.milestones ?? []).map((m) => ({ id: m.id, name: m.name })) },
    { list: "deliverables", label: ac.lists.deliverables, options: (s.deliverables ?? []).map((d) => ({ id: d.id, name: d.name })) },
    { list: "risks", label: ac.lists.risks, options: (s.risks ?? []).filter((r) => r.id).map((r) => ({ id: r.id!, name: r.description })) },
    {
      list: "successCriteria",
      label: ac.lists.successCriteria,
      options: (s.successCriteria ?? []).filter((c) => c.id).map((c) => ({ id: c.id!, name: c.statement })),
    },
    { list: "conditions", label: ac.lists.conditions, options: (s.conditions ?? []).map((c) => ({ id: c.id, name: c.action })) },
  ];
  const nameOf = (e: ProjectEvent) => {
    if ("external" in e.on && e.on.external) return e.on.external;
    const g = items.find((it) => "local" in e.on && it.list === e.on.local);
    if (g) return g.options.find((o) => o.id === e.on.id)?.name ?? e.on.id;
    if (e.on.local === "signOffs") return (s.signOffs ?? []).find((x) => x.id === e.on.id)?.label ?? ac.signOff;
    return e.on.id ?? "";
  };
  const on = draft.on && "local" in draft.on ? `${draft.on.local}:${draft.on.id}` : "";
  return (
    <section className="flex flex-col gap-3" data-cartograph-field="/spec/events">
      <Heading icon={History} title={ac.record} hint={ac.recordHint} />
      <div className="flex flex-wrap items-end gap-2 rounded-xl p-3 ring-1 ring-foreground/10" data-slot="record-event">
        <Select
          value={on}
          onValueChange={(v) => {
            const [list, id] = v.split(":");
            setDraft({ ...draft, on: { local: list as "milestones", id } });
          }}
        >
          <SelectTrigger className="h-8 w-64" aria-label={ac.item}>
            <SelectValue placeholder={ac.item} />
          </SelectTrigger>
          <SelectContent>
            {items.map((g) =>
              g.options.length > 0 ? (
                <SelectGroup key={g.list}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.options.map((o) => (
                    <SelectItem key={o.id} value={`${g.list}:${o.id}`}>
                      {o.name || o.id}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null,
            )}
          </SelectContent>
        </Select>
        <Select value={draft.happened} onValueChange={(v) => setDraft({ ...draft, happened: v as ProjectEvent["happened"] })}>
          <SelectTrigger className="h-8 w-36" aria-label={ac.happened}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HAPPENED.map((h) => (
              <SelectItem key={h} value={h}>
                {ac.happenedWords[h]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Labelled label={ac.date}>
          <Input type="date" className="h-8 w-40" value={draft.date ?? ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label={ac.date} />
        </Labelled>
        <Labelled label={ac.evidence} className="min-w-48 flex-1">
          <Input className="h-8" value={draft.evidence ?? ""} onChange={(e) => setDraft({ ...draft, evidence: e.target.value.slice(0, 240) })} maxLength={240} aria-label={ac.evidence} />
        </Labelled>
        <Button
          type="button"
          size="sm"
          disabled={!draft.on || !draft.date || !draft.happened}
          onClick={() => {
            record({ on: draft.on!, happened: draft.happened!, date: draft.date!, ...(draft.evidence ? { evidence: draft.evidence } : {}) });
            setDraft({ date: today(), happened: "reached" });
          }}
          aria-label={ac.recordIt}
          title={ac.recordIt}
        >
          <Plus />
          {ac.recordShort}
        </Button>
      </div>
      {events.length > 0 ? (
        <ol className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
          {[...events]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm" data-event={e.id}>
                <span className="tabular-nums text-muted-foreground">{e.date}</span>
                <span className="font-medium">{nameOf(e)}</span>
                <span>{ac.happenedWords[e.happened] ?? e.happened}</span>
                {e.evidence ? <span className="text-muted-foreground">{e.evidence}</span> : null}
                <span className="ml-auto text-xs text-muted-foreground">{e.recordedBy ?? ac.mergeToStamp}</span>
              </li>
            ))}
        </ol>
      ) : null}
    </section>
  );
}
