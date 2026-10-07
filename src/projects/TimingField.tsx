import { ArrowRightToLine, CalendarDays, CalendarRange, Hourglass, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQueries } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import { Input } from "@/components/ui/input";
import { DatePicker, MonthPicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { RoleRefPicker, roleOptions, useResourceNames } from "./RoleRefPicker";
import { useProjectStore } from "./store";
import type { PlanEvent, Timing } from "./types";
import { Labelled } from "./Labelled";
import { useComponentGraph } from "./components/ComponentsTable";

const tc = copy.projects.timing;

const FORMS: { form: Timing["form"]; icon: LucideIcon }[] = [
  { form: "date", icon: CalendarDays },
  { form: "window", icon: CalendarRange },
  { form: "after", icon: ArrowRightToLine },
  { form: "when", icon: Hourglass },
];

/**
 * When something falls, in any of the four forms (engine TAXONOMY.md D47):
 * on a date, in a window, after something else happens, or set once
 * something happens. The form is picked by its icon; each form asks only
 * what it needs.
 */
export function TimingField({
  value,
  onChange,
  field,
  label,
  exclude,
}: {
  value: Timing | undefined;
  onChange: (next: Timing | undefined) => void;
  /** The JSON pointer of the timing. */
  field: string;
  label: string;
  /** An item that cannot be what this waits on: the milestone itself. */
  exclude?: string;
}) {
  const form = value?.form;
  const set = (patch: Partial<Timing>) => onChange({ form: form ?? "date", ...value, ...patch } as Timing);
  return (
    <div className="flex flex-col gap-2" data-cartograph-field={field} data-slot="timing">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div role="radiogroup" aria-label={tc.formLabel} className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          {FORMS.map(({ form: f, icon: Icon }) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={form === f}
              aria-label={tc.forms[f]}
              title={tc.forms[f]}
              onClick={() => onChange(form === f ? undefined : ({ form: f } as Timing))}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors duration-150 ${form === f ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              data-timing-form={f}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {tc.short[f]}
            </button>
          ))}
        </div>
      </div>
      {form === "date" ? <When value={value?.date} onChange={(date) => set({ date })} label={tc.on} /> : null}
      {form === "window" ? (
        <div className="flex flex-wrap items-center gap-2">
          <When value={value?.notBefore} onChange={(notBefore) => set({ notBefore })} label={tc.notBefore} />
          <When value={value?.notAfter} onChange={(notAfter) => set({ notAfter })} label={tc.notAfter} />
        </div>
      ) : null}
      {form === "after" ? (
        <div className="flex flex-wrap items-center gap-2">
          <EventPicker value={value?.event} onChange={(event) => set({ event })} exclude={exclude} />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {tc.lag}
            <Input
              type="number"
              min={0}
              max={120}
              className="h-8 w-20"
              value={value?.lagMonths ?? ""}
              onChange={(e) => set({ lagMonths: e.target.value === "" ? undefined : Math.max(0, Math.min(120, Number(e.target.value))) })}
              aria-label={tc.lagLabel}
            />
            {tc.months}
          </label>
        </div>
      ) : null}
      {form === "when" ? <SetWhen value={value!} set={set} exclude={exclude} /> : null}
    </div>
  );
}

function SetWhen({ value, set, exclude }: { value: Timing; set: (patch: Partial<Timing>) => void; exclude?: string }) {
  const store = useProjectStore();
  const names = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], names);
  return (
    <div className="flex flex-col gap-2">
      <EventPicker value={value.event} onChange={(event) => set({ event })} exclude={exclude} />
      <div className="flex flex-wrap items-center gap-2">
        <When value={value.expectedBy} onChange={(expectedBy) => set({ expectedBy })} label={tc.expectedBy} />
        <div className="w-56">
          <Labelled label={tc.decidedBy}>
            <RoleRefPicker value={value.decidedBy} options={roles} onChange={(decidedBy) => set({ decidedBy })} label={tc.decidedBy} withBodies className="w-full" />
          </Labelled>
        </div>
      </div>
    </div>
  );
}

/** A month, or a day where one is fixed: a month picker with a toggle to
 * a day. */
function When({ value, onChange, label }: { value: string | undefined; onChange: (v: string | undefined) => void; label: string }) {
  const day = (value?.length ?? 0) > 7;
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {day ? (
        <DatePicker value={value} onChange={(v) => onChange(v || undefined)} aria-label={label} />
      ) : (
        <MonthPicker value={value} onChange={(v) => onChange(v || undefined)} aria-label={label} />
      )}
      <button
        type="button"
        className={`rounded p-1 ${day ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => onChange(day ? value?.slice(0, 7) : value ? `${value.slice(0, 7)}-01` : undefined)}
        aria-pressed={day}
        aria-label={tc.dayLabel}
        title={tc.dayLabel}
      >
        <Sun className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

const EXTERNAL = "__external__";

/** What an event happens to: this project's milestones, deliverables and
 * conditions, or something outside it, in words. */
/**
 * The projects linked to this one by components, either way, each with its
 * milestones: a milestone here may wait on one of theirs (engine
 * TAXONOMY.md D47).
 */
function useLinkedMilestones(self: string) {
  const client = useClient();
  const graph = useComponentGraph();
  const linked = new Map<string, string>();
  for (const e of graph.data?.edges ?? []) {
    const other = e.from.kind === "Project" && e.from.id === self ? e.to : e.to.kind === "Project" && e.to.id === self ? e.from : undefined;
    if (other?.kind === "Project" && other.id !== self) {
      linked.set(other.id, graph.data?.nodes.find((n) => n.kind === "Project" && n.id === other.id)?.name ?? other.id);
    }
  }
  const ids = [...linked.keys()].sort();
  const got = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["manifest", "Project", id],
      queryFn: () => client.get("Project", id),
    })),
  });
  return ids.map((id, i) => {
    const spec = (got[i]?.data?.manifest.spec ?? {}) as { milestones?: { id: string; name?: string }[] };
    return { id, name: linked.get(id) ?? id, milestones: (spec.milestones ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id })) };
  });
}

export function EventPicker({ value, onChange, exclude }: { value: PlanEvent | undefined; onChange: (v: PlanEvent | undefined) => void; exclude?: string }) {
  const store = useProjectStore();
  const s = store.spec;
  const others = useLinkedMilestones(store.id).filter((o) => o.milestones.length > 0);
  const groups: { list: "milestones" | "deliverables" | "conditions"; label: string; items: { id: string; name: string }[] }[] = [
    { list: "milestones", label: tc.milestones, items: (s.milestones ?? []).map((m) => ({ id: m.id, name: m.name })) },
    { list: "deliverables", label: tc.deliverables, items: (s.deliverables ?? []).map((d) => ({ id: d.id, name: d.name })) },
    { list: "conditions", label: tc.conditions, items: (s.conditions ?? []).map((c) => ({ id: c.id, name: c.action })) },
  ];
  const on = value?.on;
  const current =
    on && "local" in on && on.local
      ? `${on.local}:${on.id}`
      : on && "kind" in on && on.kind === "Project" && value?.item
        ? `project:${on.id}:${value.item}`
        : on && "external" in on && on.external !== undefined
          ? EXTERNAL
          : "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={current}
        onValueChange={(v) => {
          if (v === EXTERNAL) return onChange({ on: { external: on && "external" in on && on.external ? on.external : "" } });
          if (v.startsWith("project:")) {
            const [, project, item] = v.split(":");
            return onChange({ on: { kind: "Project", id: project }, item });
          }
          const [list, id] = v.split(":");
          onChange({ on: { local: list as "milestones", id } });
        }}
      >
        <SelectTrigger className="h-8 w-64" aria-label={tc.waitsOn}>
          <SelectValue placeholder={tc.pickEvent} />
        </SelectTrigger>
        <SelectContent>
          {groups.map((g) =>
            g.items.filter((it) => !(g.list === "milestones" && it.id === exclude)).length > 0 ? (
              <SelectGroup key={g.list}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.items
                  .filter((it) => !(g.list === "milestones" && it.id === exclude))
                  .map((it) => (
                    <SelectItem key={it.id} value={`${g.list}:${it.id}`}>
                      {it.name || it.id}
                    </SelectItem>
                  ))}
              </SelectGroup>
            ) : null,
          )}
          {others.map((o) => (
            <SelectGroup key={o.id}>
              <SelectLabel>{tc.otherProject(o.name)}</SelectLabel>
              {o.milestones.map((m) => (
                <SelectItem key={m.id} value={`project:${o.id}:${m.id}`}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectGroup>
            <SelectItem value={EXTERNAL}>{tc.somethingElse}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {current === EXTERNAL ? (
        <Input
          className="h-8 w-64"
          value={on && "external" in on ? (on.external ?? "") : ""}
          onChange={(e) => onChange({ on: { external: e.target.value.slice(0, 160) } })}
          maxLength={160}
          aria-label={tc.externalLabel}
        />
      ) : null}
    </div>
  );
}
