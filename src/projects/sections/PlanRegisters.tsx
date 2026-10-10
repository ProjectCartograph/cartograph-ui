import { Plus, Receipt, ShoppingCart, Trash2, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copy } from "@/copy";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { RoleRefPicker, roleOptions, useResourceNames } from "../RoleRefPicker";
import { TimingField } from "../TimingField";
import { useProjectStore } from "../store";
import { Labelled } from "../Labelled";
import { CURRENCY_OPTIONS } from "../currencies";
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
  needs,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  count: number;
  field: string;
  children: ReactNode;
  onAdd: () => void;
  addLabel: string;
  /** What must exist before this register can be filled, said in place of
   * it while it does not (#35). */
  needs?: string;
}) {
  if (needs && count === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm ring-1 ring-foreground/10" data-cartograph-field={field} data-needs="">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-muted-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{needs}</span>
        </div>
      </div>
    );
  }
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
const NONE = "__none__";
const DECISION = "__decision__";
/** A row about a decision: marked so, or written before rows named a
 * deliverable, with words and no deliverable. */
const isDecision = (r: Responsibility) => Boolean(r.decision) || (!r.deliverable && !!r.item);

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
  // The project's roles, then any body or party a row names besides them,
  // so nothing a row says is hidden for want of a column.
  const resourceNames = names;
  // Each role by who holds it and what it is: one person may hold two.
  const roleOf = new Map((store.spec.resources ?? []).map((r) => [r.id, r.role]));
  const columns = roles.map((o) => {
    const kind = copy.projects.resources.roleKind[roleOf.get(o.id) ?? ""] ?? "";
    return { ref: { local: "resources", id: o.id } as Ref, label: kind && kind !== o.label ? `${o.label} (${kind})` : o.label };
  });
  for (const r of list) {
    for (const ref of [...(r.responsible ?? []), r.accountable, ...(r.consulted ?? []), ...(r.informed ?? [])]) {
      if (!ref || columns.some((c) => refKey(c.ref) === refKey(ref))) continue;
      const label = ref.external ?? (ref.kind === "Resource" && ref.id ? (resourceNames(ref.id) ?? ref.id) : (ref.id ?? ""));
      columns.push({ ref, label });
    }
  }
  const deliverables = store.spec.deliverables ?? [];
  const setLetter = (i: number, ref: Ref, next: Letter | "") => {
    const r = list[i];
    const k = refKey(ref);
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
  return (
    <Register
      icon={UsersRound}
      title={rc.raci}
      hint={rc.raciHint}
      count={list.length}
      field="/spec/responsibilities"
      addLabel={rc.addRaci}
      needs={roles.length === 0 ? rc.raciNeedsRoles : undefined}
      onAdd={() => set([...list, { id: newId("r", list), item: "" }])}
    >
      <p className="text-xs text-muted-foreground">{rc.legend}</p>
      {/* One card a row, the roles down it: the editor pane is narrow,
          and a table of roles ran off its side (#35). */}
      {list.map((r, i) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-lg p-3 ring-1 ring-foreground/10" data-raci={r.id}>
          <div className="flex items-end gap-2">
            {/* A deliverable is chosen from the project's own; only a
                decision is written out (#35). */}
            <Labelled label={rc.itemKind} className="w-48 shrink-0">
            <Select
              value={isDecision(r) ? DECISION : (r.deliverable ?? "")}
              onValueChange={(v) =>
                v === DECISION
                  ? patch(i, { decision: true, deliverable: undefined, item: isDecision(r) ? r.item : "" })
                  : patch(i, { decision: undefined, deliverable: v, item: deliverables.find((d) => d.id === v)?.name ?? v })
              }
            >
              <SelectTrigger className="w-full" aria-label={rc.itemKind}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {deliverables.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name || d.id}
                  </SelectItem>
                ))}
                <SelectItem value={DECISION}>{rc.aDecision}</SelectItem>
              </SelectContent>
            </Select>
            </Labelled>
            {isDecision(r) ? (
              <Input className="min-w-0 flex-1" value={r.item} onChange={(e) => patch(i, { item: e.target.value.slice(0, 160) })} maxLength={160} aria-label={rc.decisionText} title={rc.decisionText} />
            ) : (
              <span className="flex-1" />
            )}
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => set(list.filter((_, j) => j !== i))} aria-label={copy.projects.common.remove} title={copy.projects.common.remove}>
              <Trash2 />
            </Button>
          </div>
          <div className="flex flex-col divide-y">
            {columns.map((c) => {
              const l = letterOf(r, c.ref);
              return (
                <div key={refKey(c.ref)} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 text-sm">{c.label}</span>
                  <Select value={l || NONE} onValueChange={(v) => setLetter(i, c.ref, v === NONE ? "" : (v as Letter))}>
                    <SelectTrigger
                      className={`w-48 shrink-0 ${l === "A" ? "font-medium" : l ? "" : "text-muted-foreground"}`}
                      aria-label={rc.cell(c.label, r.item || rc.item, l ? rc.letters[l] : rc.none)}
                      data-raci-cell={l}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["R", "A", "C", "I"] as Letter[]).map((x) => (
                        <SelectItem key={x} value={x}>
                          {rc.letters[x]}
                        </SelectItem>
                      ))}
                      <SelectItem value={NONE}>{rc.none}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      ))}
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
      needs={(store.spec.funding ?? []).length === 0 ? rc.costsNeedFunding : undefined}
      onAdd={() => set([...list, { id: newId("c", list), category: "" }])}
    >
      {list.map((c, i) => (
        <div key={c.id} className="flex flex-col gap-2 rounded-lg p-3 ring-1 ring-foreground/10" data-cost={c.id}>
          {/* What it covers and how much, then where it comes from and
              whether it is approved: two rows, every box labelled (#35). */}
          <div className="flex items-end gap-2">
            <Labelled label={rc.category} className="min-w-0 flex-1">
              <Input value={c.category} onChange={(e) => patch(i, { category: e.target.value.slice(0, 80) })} maxLength={80} aria-label={rc.category} />
            </Labelled>
            <Labelled label={rc.amount} className="w-32 shrink-0">
              <Input
                type="number"
                min={0}
                value={c.amount ?? ""}
                onChange={(e) => patch(i, { amount: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                aria-label={rc.amount}
              />
            </Labelled>
            <Labelled label={rc.currency} className="w-28 shrink-0">
              <Combobox
                options={CURRENCY_OPTIONS}
                value={c.currency || undefined}
                onValueChange={(v) => patch(i, { currency: v || undefined })}
                placeholder=""
                searchPlaceholder={copy.projects.resources.currencySearchPlaceholder}
                emptyText={copy.projects.resources.currencyEmpty}
                aria-label={rc.currency}
              />
            </Labelled>
            <Button type="button" variant="ghost" size="icon" onClick={() => set(list.filter((_, j) => j !== i))} aria-label={copy.projects.common.remove} title={copy.projects.common.remove}>
              <Trash2 />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Labelled label={rc.status}>
              <Select value={c.status ?? ""} onValueChange={(v) => patch(i, { status: (v || undefined) as CostLine["status"] })}>
                <SelectTrigger className="w-full" aria-label={rc.status}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((st) => (
                    <SelectItem key={st} value={st!}>
                      {rc.statuses[st!]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Labelled>
            <Labelled label={rc.source}>
              <ReferencePicker refKind="FundingSource" value={c.source} onChange={(source) => patch(i, { source })} label={rc.source} />
            </Labelled>
            <Labelled label={rc.basis}>
              <Input value={c.basis ?? ""} onChange={(e) => patch(i, { basis: e.target.value.slice(0, 160) || undefined })} maxLength={160} aria-label={rc.basis} />
            </Labelled>
            <Labelled label={rc.period}>
              <Input value={c.period ?? ""} onChange={(e) => patch(i, { period: e.target.value.slice(0, 40) || undefined })} maxLength={40} aria-label={rc.period} />
            </Labelled>
          </div>
          {c.status === "unfunded" || c.status === "beingCosted" ? (
            <Labelled label={rc.condition}>
              <Select value={c.condition ?? ""} onValueChange={(v) => patch(i, { condition: v || undefined })}>
                <SelectTrigger className="w-full" aria-label={rc.condition}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((cd) => (
                    <SelectItem key={cd.id} value={cd.id}>
                      {cd.action || cd.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Labelled>
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
