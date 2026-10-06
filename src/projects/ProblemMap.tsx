import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseDocument } from "yaml";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleAlert, Plus, TriangleAlert, Users } from "lucide-react";

import { useClient } from "@/client/context";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { ProblemLine } from "./types";

const mc = copy.projects.aim.map;

interface GapItem {
  id: string;
  name: string;
  spec?: { affects?: string[] };
}

/** Every gap with whom it affects, in one request. */
function useGaps() {
  const client = useClient();
  return useQuery({
    queryKey: ["manifests", "Gap", "expanded"],
    queryFn: async () => (await client.list("Gap", { expand: "spec" })) as GapItem[],
  });
}

/**
 * The problem as a small map: the gaps it is related to, the problem, and
 * the groups it affects, joined left to right. The two ends must be about
 * the same people (engine TAXONOMY.md D45), so a group no linked gap
 * affects, or a gap that affects none of the groups, is marked on its own
 * node with what to do; groups the gaps affect and the problem does not
 * name are offered to add.
 */
export function ProblemMap({ line, groupNames, onAddGroup }: { line: ProblemLine; groupNames: Map<string, string>; onAddGroup: (group: string) => void }) {
  const { data: gaps } = useGaps();
  const { data: groupRefs } = useReferenceOptions("BeneficiaryGroup");
  const nameOf = (g: string) => groupNames.get(g) ?? groupRefs?.names.get(g) ?? g;
  const groups = line.groups ?? [];
  const cited = (line.gaps ?? []).map((c) => gaps?.find((g) => g.id === c.gap) ?? { id: c.gap, name: c.gap });
  const affected = new Set(cited.flatMap((g) => g.spec?.affects ?? []));
  const knows = cited.some((g) => (g.spec?.affects ?? []).length > 0);
  const gapState = (g: GapItem) => {
    const a = g.spec?.affects ?? [];
    if (a.length === 0) return "unknown" as const;
    return groups.length === 0 || a.some((x) => groups.includes(x)) ? ("ok" as const) : ("outside" as const);
  };
  const groupOk = (g: string) => !knows || affected.has(g);
  const suggest = [...affected].filter((g) => !groups.includes(g));
  const breaks = [
    ...cited.filter((g) => gapState(g) === "outside").map((g) => ({ key: `gap-${g.id}`, text: mc.gapOutside(g.name), gap: g.id, unknown: false })),
    ...cited.filter((g) => gapState(g) === "unknown").map((g) => ({ key: `unknown-${g.id}`, text: mc.gapUnknown(g.name), gap: g.id, unknown: true })),
    ...(knows ? groups.filter((g) => !groupOk(g)).map((g) => ({ key: `group-${g}`, text: mc.groupOutside(nameOf(g)), gap: undefined, unknown: false })) : []),
  ];
  // A gap that says nobody it affects takes the problem's groups, saved
  // on the gap in the change set.
  const client = useClient();
  const queryClient = useQueryClient();
  const affect = useMutation({
    mutationFn: async (gap: string) => {
      const view = await client.get("Gap", gap);
      const doc = parseDocument(view.yaml);
      doc.setIn(["spec", "affects"], groups);
      await client.saveWorking("Gap", gap, doc.toString());
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["manifests", "Gap"] }),
  });

  return (
    <section aria-label={mc.label} className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3" data-cartograph-region="problem-map">
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.8fr)_auto_minmax(0,1fr)]">
        <Column label={mc.gaps}>
          {cited.length === 0 ? <Empty text={mc.noGaps} /> : null}
          {cited.map((g) => {
            const st = gapState(g);
            return (
              <Node key={g.id} tone={st === "ok" ? "ok" : st === "unknown" ? "warn" : "broken"} data-map-gap={g.id}>
                <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{g.name}</span>
              </Node>
            );
          })}
        </Column>
        <Arrow />
        <Column label={mc.problem}>
          <Node tone={line.problem?.situation ? "ok" : "warn"}>
            <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2 min-w-0">{line.problem?.situation || copy.projects.aim.problemUnwritten}</span>
          </Node>
        </Column>
        <Arrow />
        <Column label={mc.groups}>
          {groups.length === 0 ? <Empty text={mc.noGroups} /> : null}
          {groups.map((g) => (
            <Node key={g} tone={groupOk(g) ? "ok" : "broken"} data-map-group={g}>
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{nameOf(g)}</span>
            </Node>
          ))}
        </Column>
      </div>

      {suggest.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{mc.suggest}</span>
          {suggest.map((g) => (
            <Button key={g} type="button" variant="outline" size="sm" onClick={() => onAddGroup(g)} aria-label={mc.addGroup(nameOf(g))}>
              <Plus />
              {nameOf(g)}
            </Button>
          ))}
        </div>
      ) : null}

      {breaks.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm" data-slot="problem-map-breaks">
          {breaks.map((b) => (
            <li key={b.key} className={`flex items-start gap-2 ${b.unknown ? "text-foreground" : "text-destructive"}`}>
              <CircleAlert className={`mt-0.5 size-4 shrink-0 ${b.unknown ? "text-warning" : ""}`} aria-hidden="true" />
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {b.text}
                {b.unknown && b.gap && groups.length > 0 ? (
                  <Button type="button" variant="outline" size="sm" disabled={affect.isPending} onClick={() => affect.mutate(b.gap as string)}>
                    <Users />
                    {mc.useGroups(groups.map(nameOf).join(", "))}
                  </Button>
                ) : null}
                {b.gap ? (
                  <Link to="/gaps/$id" params={{ id: b.gap }} className="text-muted-foreground underline">
                    {mc.openGap}
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : cited.length > 0 && groups.length > 0 ? (
        <p className="text-sm text-muted-foreground">{mc.holds}</p>
      ) : null}
    </section>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5" aria-label={label} role="group">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const TONE = {
  ok: "border-border bg-background",
  warn: "border-warning/60 bg-warning/5",
  broken: "border-destructive border-dashed bg-destructive/5 text-destructive",
} as const;

function Node({ tone, children, ...rest }: { tone: keyof typeof TONE; children: React.ReactNode } & Record<`data-${string}`, string>) {
  return (
    <span className={`flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm ${TONE[tone]}`} data-tone={tone} {...rest}>
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <span className="rounded-md border border-dashed px-2 py-1.5 text-sm text-muted-foreground">{text}</span>;
}

/** The link between two columns: across on a wide screen, down on a
 * phone. */
function Arrow() {
  return <ArrowRight className="mx-auto size-4 rotate-90 text-muted-foreground sm:mt-5 sm:rotate-0" aria-hidden="true" />;
}
