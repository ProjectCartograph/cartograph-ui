import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CalendarRange,
  CircleAlert,
  Clock,
  Flag,
  Gauge,
  Layers,
  Map as MapIcon,
  MapPin,
  MapPinCheck,
  Package,
  Route,
  ShieldAlert,
  Target,
  UserRound,
  Users,
} from "lucide-react";

import { client } from "@/api/client";
import { copy } from "@/copy";
import { useGoalTree } from "@/surfaces/goals/api";
import type { GoalNode } from "@/surfaces/goals/tree-types";
import { Fact, Mark, type ExplorerRow } from "./Explorer";

type Spec = Record<string, unknown>;
interface Item {
  id: string;
  name: string;
  labels?: Record<string, string>;
  state?: string;
  spec?: Spec;
}

const rc = copy.registers;

/** Every record of a kind with its spec, in one request (expand=spec). */
export function useRegister(kind: string) {
  return useQuery({
    queryKey: ["manifests", kind, "expanded"],
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}", {
        params: { path: { kind }, query: { expand: "spec" } },
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : (data?.items ?? [])) as Item[];
    },
  });
}

/** id to name for a kind a register refers to. */
function useNames(kind: string): Map<string, string> {
  const { data } = useQuery({
    queryKey: ["manifests", kind],
    queryFn: async () => {
      const { data, error } = await client.GET("/manifests/{kind}", { params: { path: { kind } } });
      if (error) throw error;
      return (Array.isArray(data) ? data : (data?.items ?? [])) as { id: string; name: string }[];
    },
  });
  return new Map((data ?? []).map((d) => [d.id, d.name]));
}

/** For each outcome or objective, the top goal it sits under. */
function useGoalOf(): { goalOf: Map<string, string>; name: Map<string, string> } {
  const { data } = useGoalTree();
  const goalOf = new Map<string, string>();
  const name = new Map<string, string>();
  const walk = (ns: GoalNode[], top?: string) =>
    ns.forEach((n) => {
      const root = top ?? n.name;
      goalOf.set(n.id, root);
      name.set(n.id, n.name);
      walk(n.children ?? [], root);
    });
  walk(data?.nodes ?? []);
  return { goalOf, name };
}

const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const names = (ids: string[], m: Map<string, string>) => ids.map((i) => m.get(i) ?? i).join(", ");

function months(spec: Spec): number {
  return list(obj(spec.timeline).phases).reduce((a, p) => a + (Number(p.months) || 0), 0);
}

function Text({ children }: { children: string }) {
  return children ? <p className="text-sm text-muted-foreground">{children}</p> : null;
}

// ---------------------------------------------------------------- Projects

export function useProjectRows(): { rows: ExplorerRow[]; loading: boolean } {
  const q = useRegister("Project");
  const programmes = useNames("Programme");
  const teams = useNames("Team");
  const { name: goals } = useGoalOf();
  const items = q.data ?? [];
  const byId = new Map(items.map((i) => [i.id, i]));

  const row = (i: Item): ExplorerRow => {
    const s = i.spec ?? {};
    const al = obj(s.alignment);
    const objective = str(list(s.objectives)[0]?.objective);
    const problem = str(obj(list(obj(s.summary).problems)[0]?.problem).situation);
    const m = months(s);
    return {
      id: i.id,
      name: i.name,
      labels: i.labels,
      folder: [names(strs(al.programmes).slice(0, 1), programmes) || rc.noProgramme],
      marks: (
        <>
          <Mark icon={Target} label={rc.objectives} n={list(s.objectives).length} />
          <Mark icon={Package} label={rc.deliverables} n={list(s.deliverables).length} />
          <Mark icon={Users} label={rc.roles} n={list(s.resources).length} />
          <Mark icon={ShieldAlert} label={rc.risks} n={list(s.risks).length} />
          <Mark icon={Banknote} label={rc.funding} on={list(s.funding).length > 0} />
          <Mark icon={CalendarRange} label={rc.months} n={m} />
        </>
      ),
      preview: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
            <Mark icon={Target} label={rc.objectives} n={list(s.objectives).length} />
            <Mark icon={Package} label={rc.deliverables} n={list(s.deliverables).length} />
            <Mark icon={Users} label={rc.roles} n={list(s.resources).length} />
            <Mark icon={ShieldAlert} label={rc.risks} n={list(s.risks).length} />
            <Mark icon={Banknote} label={rc.funding} on={list(s.funding).length > 0} />
          </div>
          <Fact icon={CircleAlert} label={rc.problem}>{capital(problem)}</Fact>
          <Fact icon={Target} label={rc.objective}>{capital(objective)}</Fact>
          <Fact icon={Flag} label={rc.outcomes}>{names(strs(al.goals), goals)}</Fact>
          <Fact icon={Layers} label={rc.programme}>{names(strs(al.programmes), programmes)}</Fact>
          <Fact icon={Users} label={rc.team}>{teams.get(str(s.team)) ?? str(s.team)}</Fact>
          <Fact icon={CalendarRange} label={rc.schedule}>
            {m > 0 ? rc.monthsFrom(m, str(obj(s.timeline).start)) : ""}
          </Fact>
          <Fact icon={Route} label={rc.components}>
            {items.filter((c) => str(obj(c.spec?.alignment).partOf) === i.id).map((c) => c.name).join(", ")}
          </Fact>
        </div>
      ),
    };
  };

  // Components sit under the project they are part of, like files in a
  // folder; the rest are filed by their programme.
  const rows = items
    .filter((i) => !byId.has(str(obj(i.spec?.alignment).partOf)))
    .map((i) => ({
      ...row(i),
      children: items.filter((c) => str(obj(c.spec?.alignment).partOf) === i.id).map(row),
    }));
  return { rows, loading: q.isLoading };
}

// -------------------------------------------------------------- Programmes

export function useProgrammeRows(): { rows: ExplorerRow[]; loading: boolean } {
  const q = useRegister("Programme");
  const projects = useRegister("Project");
  const teams = useNames("Team");
  const resources = useNames("Resource");
  const { goalOf, name: goals } = useGoalOf();
  const rows = (q.data ?? []).map((i): ExplorerRow => {
    const s = i.spec ?? {};
    const aim = obj(s.aim);
    const members = (projects.data ?? []).filter((p) => strs(obj(p.spec?.alignment).programmes).includes(i.id));
    const outcomes = strs(s.goals);
    return {
      id: i.id,
      name: i.name,
      labels: i.labels,
      folder: [goalOf.get(outcomes[0] ?? "") ?? rc.noGoal],
      marks: (
        <>
          <Mark icon={Flag} label={rc.outcomes} n={outcomes.length} />
          <Mark icon={Route} label={rc.pathway} n={list(s.pathway).length} />
          <Mark icon={CircleAlert} label={rc.problems} n={list(s.problems).length} />
          <Mark icon={Package} label={rc.projects} n={members.length} />
          <Mark icon={Gauge} label={rc.kpis} n={strs(s.kpis).length} />
          <Mark icon={UserRound} label={rc.sponsor} on={!!str(s.sponsor)} />
        </>
      ),
      preview: (
        <div className="flex flex-col gap-3">
          <Text>{[capital(str(aim.change)), str(aim.gain) ? `so ${str(aim.gain)}` : ""].filter(Boolean).join(", ")}</Text>
          <Fact icon={Flag} label={rc.outcomes}>{names(outcomes, goals)}</Fact>
          <Fact icon={Package} label={rc.projects}>{members.map((p) => p.name).join(", ")}</Fact>
          <Fact icon={UserRound} label={rc.sponsor}>{resources.get(str(s.sponsor)) ?? str(s.sponsor)}</Fact>
          <Fact icon={Users} label={rc.team}>{teams.get(str(s.leadTeam)) ?? str(s.leadTeam)}</Fact>
          <Fact icon={Route} label={rc.pathway}>{list(s.pathway).length ? rc.steps(list(s.pathway).length) : ""}</Fact>
        </div>
      ),
    };
  });
  return { rows, loading: q.isLoading };
}

// -------------------------------------------------------------- Operations

export function useOperationRows(): { rows: ExplorerRow[]; loading: boolean } {
  const q = useRegister("Operation");
  const teams = useNames("Team");
  const programmes = useNames("Programme");
  const resources = useNames("Resource");
  const kpis = useNames("KPI");
  const rows = (q.data ?? []).map((i): ExplorerRow => {
    const s = i.spec ?? {};
    return {
      id: i.id,
      name: i.name,
      labels: i.labels,
      folder: [teams.get(str(s.team)) ?? (str(s.team) || rc.noTeam)],
      marks: (
        <>
          <Mark icon={UserRound} label={rc.serviceOwner} on={!!str(s.serviceOwner)} />
          <Mark icon={Clock} label={rc.serviceHours} on={!!str(s.serviceWindow)} />
          <Mark icon={Gauge} label={rc.kpis} n={strs(s.kpis).length} />
          <Mark icon={Layers} label={rc.programmes} n={strs(s.programmes).length} />
        </>
      ),
      preview: (
        <div className="flex flex-col gap-3">
          <Text>{capital(str(s.purpose))}</Text>
          <Fact icon={UserRound} label={rc.serviceOwner}>{resources.get(str(s.serviceOwner)) ?? str(s.serviceOwner)}</Fact>
          <Fact icon={Clock} label={rc.serviceHours}>{str(s.serviceWindow)}</Fact>
          <Fact icon={Gauge} label={rc.kpis}>{names(strs(s.kpis), kpis)}</Fact>
          <Fact icon={Layers} label={rc.programmes}>{names(strs(s.programmes), programmes)}</Fact>
        </div>
      ),
    };
  });
  return { rows, loading: q.isLoading };
}

// -------------------------------------------------------------------- Gaps

export function useGapRows(): { rows: ExplorerRow[]; loading: boolean } {
  const q = useRegister("Gap");
  const kpis = useNames("KPI");
  const segments = useNames("Segment");
  const { goalOf, name: goals } = useGoalOf();
  const rows = (q.data ?? []).map((i): ExplorerRow => {
    const s = i.spec ?? {};
    const outcomes = strs(s.outcomes);
    return {
      id: i.id,
      name: i.name,
      labels: i.labels,
      folder: [goalOf.get(outcomes[0] ?? "") ?? rc.noOutcome],
      marks: (
        <>
          <Mark icon={MapPin} label={rc.current} on={!!str(s.current)} />
          <Mark icon={MapPinCheck} label={rc.desired} on={!!str(s.desired)} />
          <Mark icon={Gauge} label={rc.kpi} on={!!str(s.measure)} />
          <Mark icon={Flag} label={rc.outcomes} n={outcomes.length} />
          <Mark icon={MapIcon} label={rc.segments} n={strs(s.segments).length} />
        </>
      ),
      preview: (
        <div className="flex flex-col gap-3">
          <Fact icon={MapPin} label={rc.current}>{str(s.current)}</Fact>
          <Fact icon={MapPinCheck} label={rc.desired}>{str(s.desired) || <span className="text-muted-foreground">{rc.notSet}</span>}</Fact>
          <Fact icon={Gauge} label={rc.kpi}>{kpis.get(str(s.measure)) ?? str(s.measure)}</Fact>
          <Fact icon={Flag} label={rc.outcomes}>{names(outcomes, goals)}</Fact>
          <Fact icon={MapIcon} label={rc.segments}>{names(strs(s.segments), segments)}</Fact>
        </div>
      ),
    };
  });
  return { rows, loading: q.isLoading };
}

// -------------------------------------------------------------------- KPIs

export function useKPIRows(): { rows: ExplorerRow[]; loading: boolean } {
  const q = useRegister("KPI");
  const sources = useNames("DataSource");
  const cycles = useNames("ReportingCycle");
  const { name: goals } = useGoalOf();
  const point = (v: unknown, unit: string) => {
    const p = obj(v);
    if (p.value === undefined) return "";
    return [`${p.value}${unit === "percent" ? "%" : ""}`, str(p.date)].filter(Boolean).join(", ");
  };
  const rows = (q.data ?? []).map((i): ExplorerRow => {
    const s = i.spec ?? {};
    const unit = str(s.unit);
    return {
      id: i.id,
      name: i.name,
      labels: i.labels,
      folder: [rc.resultLevel[str(s.resultLevel)] ?? rc.noLevel],
      marks: (
        <>
          <Mark icon={MapPin} label={rc.baseline} on={obj(s.baseline).value !== undefined} />
          <Mark icon={MapPinCheck} label={rc.target} on={obj(s.target).value !== undefined} />
          <Mark icon={Flag} label={rc.outcomes} n={strs(s.goals).length} />
        </>
      ),
      preview: (
        <div className="flex flex-col gap-3">
          <Text>{capital(str(s.definition))}</Text>
          <Fact icon={MapPin} label={rc.baseline}>{point(s.baseline, unit)}</Fact>
          <Fact icon={MapPinCheck} label={rc.target}>{point(s.target, unit)}</Fact>
          <Fact icon={Flag} label={rc.outcomes}>{names(strs(s.goals), goals)}</Fact>
          <Fact icon={CalendarRange} label={rc.cycle}>{cycles.get(str(s.cycle)) ?? str(s.cycle)}</Fact>
          <Fact icon={Gauge} label={rc.source}>{sources.get(str(s.source)) ?? str(s.source)}</Fact>
        </div>
      ),
    };
  });
  return { rows, loading: q.isLoading };
}
