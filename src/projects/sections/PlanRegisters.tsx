import { Gavel, Plus, Receipt, ShoppingCart, Trash2, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { RoleRefPicker, roleOptions, useResourceNames } from "../RoleRefPicker";
import { TimingField } from "../TimingField";
import { useProjectStore } from "../store";
import { Labelled } from "../Labelled";
import type { CostLine, ProcurementItem, Ref, Responsibility } from "../types";

const rc = copy.projects.registers;

function newId(prefix: string, taken: { id: string }[]) {
  let n = taken.length + 1;
  while (taken.some((t) => t.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** A register of the plan, folded under its icon and count until it is
 * used. */
function Register({
  icon: Icon,
  title,
  hint,
  count,
  field,
  children,
  onAdd,
  addLabel,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  count: number;
  field: string;
  children: ReactNode;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <details className="rounded-xl ring-1 ring-foreground/10" open={count > 0} data-cartograph-field={field}>
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium" title={hint}>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-sm text-muted-foreground">{hint}</p>
        {children}
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={onAdd} aria-label={addLabel} title={addLabel}>
          <Plus />
          {rc.add}
        </Button>
      </div>
    </details>
  );
}

type Letter = "R" | "A" | "C" | "I";
const CYCLE: (Letter | "")[] = ["", "R", "A", "C", "I"];

const refKey = (r: Ref | undefined) => (r ? `${r.local ?? r.kind ?? "x"}:${r.id ?? r.external}` : "");

/**
 * Who is responsible, accountable, consulted and informed (RACI, engine
 * TAXONOMY.md D50): one row per decision or deliverable, one column per
 * role of the project. A cell steps through R, A, C, I and blank; a row
 * has one A, so naming a second moves it.
 */
export function RaciEditor() {
  const store = useProjectStore();
  const names = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], names);
  const list = store.spec.responsibilities ?? [];
  const set = (next: Responsibility[]) => store.updateSpec((s) => ({ ...s, responsibilities: next.length > 0 ? next : undefined }));
  const patch = (i: number, p: Partial<Responsibility>) => set(list.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const letterOf = (r: Responsibility, ref: Ref): Letter | "" => {
    const k = refKey(ref);
    if (refKey(r.accountable) === k) return "A";
    if ((r.responsible ?? []).some((x) => refKey(x) === k)) return "R";
    if ((r.consulted ?? []).some((x) => refKey(x) === k)) return "C";
    if ((r.informed ?? []).some((x) => refKey(x) === k)) return "I";
    return "";
  };
  const cycle = (i: number, ref: Ref) => {
    const r = list[i];
    const k = refKey(ref);
    const next = CYCLE[(CYCLE.indexOf(letterOf(r, ref)) + 1) % CYCLE.length];
    const without = (xs: Ref[] | undefined) => {
      const out = (xs ?? []).filter((x) => refKey(x) !== k);
      return out.length > 0 ? out : undefined;
    };
    const p: Partial<Responsibility> = {
      responsible: without(r.responsible),
      consulted: without(r.consulted),
      informed: without(r.informed),
      accountable: refKey(r.accountable) === k ? undefined : r.accountable,
    };
    if (next === "R") p.responsible = [...(p.responsible ?? []), ref];
    if (next === "A") p.accountable = ref;
    if (next === "C") p.consulted = [...(p.consulted ?? []), ref];
    if (next === "I") p.informed = [...(p.informed ?? []), ref];
    patch(i, p);
  };
  const columns = roles.map((o) => ({ ref: { local: "resources", id: o.id } as Ref, label: o.label }));
  return (
    <Register
      icon={UsersRound}
      title={rc.raci}
      hint={rc.raciHint}
      count={list.length}
      field="/spec/responsibilities"
      addLabel={rc.addRaci}
      onAdd={() => set([...list, { id: newId("r", list), item: "" }])}
    >
      {list.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-slot="raci">
            <thead>
              <tr>
                <th className="p-1 text-left font-medium text-muted-foreground">{rc.item}</th>
                {columns.map((c) => (
                  <th key={refKey(c.ref)} className="max-w-24 p-1 text-center text-xs font-medium text-muted-foreground" title={c.label}>
                    <span className="line-clamp-2">{c.label}</span>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id} className="border-t" data-raci={r.id}>
                  <td className="min-w-56 p-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-pressed={Boolean(r.decision)}
                        onClick={() => patch(i, { decision: r.decision ? undefined : true })}
                        className={`rounded p-1 ${r.decision ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        aria-label={rc.decision}
                        title={rc.decision}
                      >
                        <Gavel className="size-3.5" />
                      </button>
                      <Input
                        className="h-8"
                        value={r.item}
                        onChange={(e) => patch(i, { item: e.target.value.slice(0, 160) })}
                        maxLength={160}
                        aria-label={rc.item}
                      />
                    </div>
                  </td>
                  {columns.map((c) => {
                    const l = letterOf(r, c.ref);
                    return (
                      <td key={refKey(c.ref)} className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => cycle(i, c.ref)}
                          className={`size-8 rounded-md text-xs font-semibold ring-1 ${l === "A" ? "bg-primary text-primary-foreground ring-primary" : l ? "bg-muted ring-foreground/20" : "ring-foreground/10 text-muted-foreground hover:bg-muted"}`}
                          aria-label={rc.cell(c.label, r.item || rc.item, l ? rc.letters[l] : rc.none)}
                          title={l ? rc.letters[l] : rc.cycleHint}
                          data-raci-cell={l}
                        >
                          {l}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-1">
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
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">{rc.legend}</p>
        </div>
      ) : null}
    </Register>
  );
}

const STATUSES: CostLine["status"][] = ["approved", "requested", "beingCosted", "unfunded"];

/** The budget as cost lines (engine TAXONOMY.md D51). An unfunded line
 * names the condition that decides it. */
export function CostsEditor() {
  const store = useProjectStore();
  const list = store.spec.costs ?? [];
  const conditions = store.spec.conditions ?? [];
  const set = (next: CostLine[]) => store.updateSpec((s) => ({ ...s, costs: next.length > 0 ? next : undefined }));
  const patch = (i: number, p: Partial<CostLine>) => set(list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const total = list.reduce((t, c) => t + (c.amount ?? 0), 0);
  return (
    <Register
      icon={Receipt}
      title={rc.costs}
      hint={rc.costsHint}
      count={list.length}
      field="/spec/costs"
      addLabel={rc.addCost}
      onAdd={() => set([...list, { id: newId("c", list), category: "" }])}
    >
      {list.map((c, i) => (
        <div key={c.id} className="grid gap-2 rounded-lg p-2 ring-1 ring-foreground/10 sm:grid-cols-6" data-cost={c.id}>
          <Labelled label={rc.category} className="sm:col-span-2">
            <Input
              value={c.category}
              onChange={(e) => patch(i, { category: e.target.value.slice(0, 80) })}
              maxLength={80}
              aria-label={rc.category}
              title={rc.category}
            />
          </Labelled>
          <Input
            type="number"
            min={0}
            value={c.amount ?? ""}
            onChange={(e) => patch(i, { amount: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
            aria-label={rc.amount}
            title={rc.amount}
          />
          <Labelled label={rc.currency}>
            <Input
              value={c.currency ?? ""}
              onChange={(e) =>
                patch(i, {
                  currency:
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z]/g, "")
                      .slice(0, 3) || undefined,
                })
              }
              maxLength={3}
              aria-label={rc.currency}
              title={rc.currency}
            />
          </Labelled>
          <Labelled label={rc.status}>
            <Select value={c.status ?? ""} onValueChange={(v) => patch(i, { status: (v || undefined) as CostLine["status"] })}>
              <SelectTrigger aria-label={rc.status}>
                <SelectValue placeholder={rc.status} />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s!}>
                    {rc.statuses[s!]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labelled>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="self-end"
            onClick={() => set(list.filter((_, j) => j !== i))}
            aria-label={copy.projects.common.remove}
            title={copy.projects.common.remove}
          >
            <Trash2 />
          </Button>
          <Labelled label={rc.basis} className="sm:col-span-3">
            <Input
              value={c.basis ?? ""}
              onChange={(e) => patch(i, { basis: e.target.value.slice(0, 160) || undefined })}
              maxLength={160}
              aria-label={rc.basis}
              title={rc.basis}
            />
          </Labelled>
          <Labelled label={rc.period}>
            <Input
              value={c.period ?? ""}
              onChange={(e) => patch(i, { period: e.target.value.slice(0, 40) || undefined })}
              maxLength={40}
              aria-label={rc.period}
              title={rc.period}
            />
          </Labelled>
          <div className="sm:col-span-2">
            <Labelled label={rc.source}>
              <ReferencePicker refKind="FundingSource" value={c.source} onChange={(source) => patch(i, { source })} label={rc.source} />
            </Labelled>
          </div>
          {c.status === "unfunded" || c.status === "beingCosted" ? (
            <Select value={c.condition ?? ""} onValueChange={(v) => patch(i, { condition: v || undefined })}>
              <SelectTrigger className="sm:col-span-6" aria-label={rc.condition}>
                <SelectValue placeholder={rc.condition} />
              </SelectTrigger>
              <SelectContent>
                {conditions.map((cd) => (
                  <SelectItem key={cd.id} value={cd.id}>
                    {cd.action || cd.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ))}
      {list.length > 0 ? <p className="text-sm font-medium tabular-nums">{rc.total(total.toLocaleString("en"))}</p> : null}
    </Register>
  );
}

/** What the project buys (engine TAXONOMY.md D51). */
export function ProcurementEditor() {
  const store = useProjectStore();
  const names = useResourceNames();
  const roles = roleOptions(store.spec.resources ?? [], names);
  const list = store.spec.procurement ?? [];
  const set = (next: ProcurementItem[]) => store.updateSpec((s) => ({ ...s, procurement: next.length > 0 ? next : undefined }));
  const patch = (i: number, p: Partial<ProcurementItem>) => set(list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <Register
      icon={ShoppingCart}
      title={rc.procurement}
      hint={rc.procurementHint}
      count={list.length}
      field="/spec/procurement"
      addLabel={rc.addProcurement}
      onAdd={() => set([...list, { id: newId("p", list), requirement: "" }])}
    >
      {list.map((p, i) => (
        <div key={p.id} className="flex flex-col gap-2 rounded-lg p-2 ring-1 ring-foreground/10" data-procurement={p.id}>
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <Labelled label={rc.requirement}>
              <Input
                value={p.requirement}
                onChange={(e) => patch(i, { requirement: e.target.value.slice(0, 160) })}
                maxLength={160}
                aria-label={rc.requirement}
                title={rc.requirement}
              />
            </Labelled>
            <Labelled label={rc.value}>
              <Input
                value={p.valueNote ?? (p.value !== undefined ? String(p.value) : "")}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = Number(v.replace(/,/g, ""));
                  patch(
                    i,
                    v.trim() !== "" && !Number.isNaN(n) ? { value: n, valueNote: undefined } : { value: undefined, valueNote: v.slice(0, 120) || undefined },
                  );
                }}
                aria-label={rc.value}
                title={rc.value}
              />
            </Labelled>
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
          <div className="grid gap-2 sm:grid-cols-3">
            <Labelled label={rc.method}>
              <Input
                value={p.method ?? ""}
                onChange={(e) => patch(i, { method: e.target.value.slice(0, 120) || undefined })}
                maxLength={120}
                aria-label={rc.method}
                title={rc.method}
              />
            </Labelled>
            <Labelled label={rc.leadTime}>
              <Input
                value={p.leadTime ?? ""}
                onChange={(e) => patch(i, { leadTime: e.target.value.slice(0, 40) || undefined })}
                maxLength={40}
                aria-label={rc.leadTime}
                title={rc.leadTime}
              />
            </Labelled>
            <Labelled label={rc.owner}>
              <RoleRefPicker value={p.owner} options={roles} onChange={(owner) => patch(i, { owner })} label={rc.owner} withBodies className="w-full" />
            </Labelled>
          </div>
          <TimingField
            value={p.requiredBy}
            onChange={(requiredBy) => patch(i, { requiredBy })}
            field={`/spec/procurement/${i}/requiredBy`}
            label={rc.requiredBy}
          />
        </div>
      ))}
    </Register>
  );
}
