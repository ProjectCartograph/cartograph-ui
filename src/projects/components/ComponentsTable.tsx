import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, FolderKanban, Layers, RefreshCcw, Search, Share2, Timer } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useClient } from "@/client/context";
import type { ComponentGraph, ComponentNode, LinkKind, WorkRef } from "@/client/port";
import { copy } from "@/copy";

const cc = copy.projects.components;

/** One component as the manifest keeps it (TAXONOMY.md D46). */
export interface Component {
  kind: "Project" | "Programme";
  id: string;
  why?: string;
}

export const KIND_ICON = { Project: FolderKanban, Programme: Layers } as const;

/** The resolved graph of components, as the change set in hand reads it. */
export function useComponentGraph() {
  const client = useClient();
  return useQuery({
    queryKey: ["components"],
    queryFn: () => client.components(),
  });
}

const key = (r: WorkRef) => `${r.kind}/${r.id}`;

/** What depends on from, directly: the work that lists it. */
export function dependentsOf(graph: ComponentGraph | undefined, from: WorkRef): ComponentNode[] {
  if (!graph) return [];
  const at = new Map(graph.nodes.map((n) => [key(n), n]));
  return graph.edges.filter((e) => key(e.to) === key(from)).flatMap((e) => at.get(key(e.from)) ?? []);
}

type Show = "all" | "Project" | "Programme" | "picked";
type Order = "name" | "dependents" | "months";

/**
 * Every project and programme this work could depend on, as a table to
 * filter and sort rather than a search box: its kind, how long it takes,
 * how much work already depends on it, and whether it is on the critical
 * path, the most depended on or in a loop. A row that may not be added
 * says why, and stays in the table so the reason is read where the
 * person looks for it.
 */
export function ComponentsTable({ from, value, onChange }: { from: WorkRef; value: Component[]; onChange: (next: Component[]) => void }) {
  const client = useClient();
  const link: LinkKind = from.kind === "Project" ? "project-component" : "programme-component";
  const graph = useComponentGraph();
  // What may not be added depends only on what others list, never on this
  // work's own components, so it is read once and the picks stay local.
  const candidates = useQuery({
    queryKey: ["link-candidates", link, from.id],
    queryFn: () => client.linkCandidates(link, from.id),
  });
  const [text, setText] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [order, setOrder] = useState<Order>("name");

  const picked = useMemo(() => new Map(value.map((c) => [`${c.kind}/${c.id}`, c])), [value]);
  const reasons = useMemo(() => new Map((candidates.data ?? []).map((c) => [`${c.kind}/${c.id}`, c.reason])), [candidates.data]);
  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = (graph.data?.nodes ?? []).filter(
      (n) =>
        !(n.kind === from.kind && n.id === from.id) &&
        (show === "all" || (show === "picked" ? picked.has(key(n)) : n.kind === show)) &&
        (q === "" || n.name.toLowerCase().includes(q) || n.id.includes(q)),
    );
    const by: Record<Order, (a: ComponentNode, b: ComponentNode) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      dependents: (a, b) => b.dependents - a.dependents || a.name.localeCompare(b.name),
      months: (a, b) => b.months - a.months || a.name.localeCompare(b.name),
    };
    // What is picked comes first, so it is never lost below the fold.
    return list.sort((a, b) => Number(picked.has(key(b))) - Number(picked.has(key(a))) || by[order](a, b));
  }, [graph.data, text, show, order, picked, from.kind, from.id]);

  function toggle(n: ComponentNode) {
    onChange(picked.has(key(n)) ? value.filter((c) => `${c.kind}/${c.id}` !== key(n)) : [...value, { kind: n.kind, id: n.id }]);
  }
  function setWhy(n: ComponentNode, why: string) {
    onChange(value.map((c) => (`${c.kind}/${c.id}` === key(n) ? { ...c, why: why || undefined } : c)));
  }
  const sortHead = (o: Order, label: string) => (
    <button
      type="button"
      onClick={() => setOrder(o)}
      className={`inline-flex items-center gap-1 ${order === o ? "text-foreground" : ""}`}
      aria-pressed={order === o}
      title={cc.sortBy(label)}
    >
      {label}
      <ArrowDownUp className="size-3" aria-hidden="true" />
    </button>
  );

  return (
    <div className="flex flex-col gap-2" data-cartograph-field="/spec/components" data-slot="components-table">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={text} onChange={(e) => setText(e.target.value)} className="pl-8" aria-label={cc.filter} />
        </div>
        <ToggleGroup type="single" variant="outline" size="sm" value={show} onValueChange={(v) => v && setShow(v as Show)} aria-label={cc.show}>
          <ToggleGroupItem value="all">{cc.all}</ToggleGroupItem>
          <ToggleGroupItem value="Project" aria-label={cc.projects} title={cc.projects}>
            <FolderKanban />
          </ToggleGroupItem>
          <ToggleGroupItem value="Programme" aria-label={cc.programmes} title={cc.programmes}>
            <Layers />
          </ToggleGroupItem>
          <ToggleGroupItem value="picked">{cc.picked(value.length)}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="max-h-96 overflow-auto rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-8">
                <span className="sr-only">{cc.dependsOn}</span>
              </TableHead>
              <TableHead>{sortHead("name", cc.name)}</TableHead>
              <TableHead className="text-right">{sortHead("months", cc.months)}</TableHead>
              <TableHead className="text-right">{sortHead("dependents", cc.dependents)}</TableHead>
              <TableHead>
                <span className="sr-only">{cc.marks}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((n) => {
              const on = picked.has(key(n));
              const reason = on ? undefined : reasons.get(key(n));
              const Icon = KIND_ICON[n.kind];
              return (
                <TableRow key={key(n)} data-component={key(n)} data-state={on ? "selected" : undefined} className={reason ? "text-muted-foreground" : ""}>
                  <TableCell className="align-top">
                    <Checkbox checked={on} disabled={Boolean(reason)} onCheckedChange={() => toggle(n)} aria-label={cc.dependOn(n.name)} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0 text-muted-foreground" role="img" aria-label={n.kind === "Project" ? cc.project : cc.programme} />
                      <span className="font-medium">{n.name}</span>
                    </div>
                    {reason ? <p className="mt-0.5 text-xs">{reason}</p> : null}
                    {on ? (
                      <label className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground">
                        {cc.whyLabel}
                        <Input
                          value={picked.get(key(n))?.why ?? ""}
                          onChange={(e) => setWhy(n, e.target.value.slice(0, 240))}
                          maxLength={240}
                          className="h-8"
                          aria-label={cc.why(n.name)}
                          title={cc.whyHint}
                          data-cartograph-field={`/spec/components/${value.findIndex((c) => `${c.kind}/${c.id}` === key(n))}/why`}
                        />
                      </label>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right align-top tabular-nums">{n.months > 0 ? cc.monthsValue(n.months) : ""}</TableCell>
                  <TableCell className="text-right align-top tabular-nums">{n.dependents}</TableCell>
                  <TableCell className="align-top">
                    <Marks node={n} />
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {graph.isLoading ? cc.loading : cc.none}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** The three marks a piece of work can carry, each an icon with its words. */
export function Marks({ node }: { node: ComponentNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {node.inLoop ? (
        <RefreshCcw className="size-4 text-destructive" role="img" aria-label={cc.inLoop} data-mark="loop">
          <title>{cc.inLoop}</title>
        </RefreshCcw>
      ) : null}
      {node.critical ? (
        <Timer className="size-4 text-warning" role="img" aria-label={cc.critical} data-mark="critical">
          <title>{cc.critical}</title>
        </Timer>
      ) : null}
      {node.mostDependedOn ? (
        <Share2 className="size-4 text-primary" role="img" aria-label={cc.mostDependedOn} data-mark="shared">
          <title>{cc.mostDependedOn}</title>
        </Share2>
      ) : null}
    </span>
  );
}
