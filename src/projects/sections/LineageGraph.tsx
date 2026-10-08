import { useQuery } from "@tanstack/react-query";
import {
  Database,
  FolderKanban,
  Gauge,
  Plus,
  type LucideIcon,
} from "lucide-react";

import { useClient } from "@/client/context";
import type { LineageNode } from "@/client/port";
import { copy } from "@/copy";

const lc = copy.projects.data.lineage;

const ICON: Record<string, LucideIcon> = {
  DataSource: Database,
  Project: FolderKanban,
  KPI: Gauge,
};
const COL = 190;
const NODE_W = 160;
const NODE_H = 34;
const ROW = 46;
const TOP = 30;

/**
 * The project's data as a lineage, left to right as the data flows: the
 * projects producing what it uses, the sources it uses, the project, what
 * it produces into, and the KPIs and projects reading that. The engine
 * places every node; this draws it. A plus on either side adds a source
 * or an output, the same as the lists below.
 */
export function LineageGraph({
  project,
  name,
  uses,
  produces,
  onAddUse,
  onAddOutput,
}: {
  project: string;
  name: string;
  uses: string[];
  produces: string[];
  onAddUse: () => void;
  onAddOutput: () => void;
}) {
  const client = useClient();
  const lineage = useQuery({
    queryKey: ["lineage", project, name, uses, produces],
    queryFn: () => client.lineage(project, name, uses, produces),
    placeholderData: (prev) => prev,
  });
  const nodes = lineage.data?.nodes ?? [];
  const edges = lineage.data?.edges ?? [];
  // Columns drawn: the three around the project always, the outer two
  // when anything is in them.
  const cols = [0, 1, 2, 3, 4].filter((c) =>
    c >= 1 && c <= 3 ? true : nodes.some((n) => n.x === c),
  );
  const colX = (c: number) => 12 + cols.indexOf(c) * COL;
  const ys = nodes.map((n) => n.y);
  const lo = Math.min(-0.5, ...ys);
  const hi = Math.max(1.5, ...ys);
  const yOf = (y: number) => TOP + (y - lo) * ROW;
  const width = 12 + cols.length * COL - (COL - NODE_W) + 12;
  const height = yOf(hi) + NODE_H + 12;
  const at = new Map(nodes.map((n) => [`${n.kind}/${n.id}`, n]));
  const addY = (c: number) => {
    const inCol = nodes.filter((n) => n.x === c).map((n) => n.y);
    return inCol.length ? Math.max(...inCol) + 1 : 0;
  };

  return (
    <figure
      className="overflow-x-auto rounded-xl bg-background ring-1 ring-foreground/10"
      data-slot="lineage"
    >
      {/* Fitted to the pane it sits in, down to seven tenths of its size
          so the names stay legible, and scrolled beyond that. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={lc.label}
        className="block h-auto w-full"
        style={{ maxWidth: width, minWidth: Math.round(width * 0.7) }}
      >
        <defs>
          <marker
            id="lineage-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 8 4 0 8Z" fill="var(--color-muted-foreground)" />
          </marker>
        </defs>
        {cols.map((c) => (
          <text
            key={c}
            x={colX(c)}
            y={16}
            fontSize="11"
            fill="var(--color-muted-foreground)"
          >
            {lc.columns[c]}
          </text>
        ))}
        {edges.map((ed) => {
          const a = at.get(`${ed.from.kind}/${ed.from.id}`);
          const b = at.get(`${ed.to.kind}/${ed.to.id}`);
          if (!a || !b) return null;
          const x1 = colX(a.x) + NODE_W;
          const y1 = yOf(a.y) + NODE_H / 2;
          const x2 = colX(b.x) - 2;
          const y2 = yOf(b.y) + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={`${ed.from.id}>${ed.to.id}`}
              d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
              fill="none"
              stroke="var(--color-muted-foreground)"
              strokeOpacity=".6"
              strokeWidth={1.25}
              markerEnd="url(#lineage-arrow)"
            />
          );
        })}
        {nodes.map((n) => (
          <Node key={`${n.kind}/${n.id}`} n={n} x={colX(n.x)} y={yOf(n.y)} />
        ))}
        <AddNode
          x={colX(1)}
          y={yOf(addY(1))}
          label={lc.addUse}
          onClick={onAddUse}
          action="lineage-add-use"
        />
        <AddNode
          x={colX(3)}
          y={yOf(addY(3))}
          label={lc.addOutput}
          onClick={onAddOutput}
          action="lineage-add-output"
        />
      </svg>
    </figure>
  );
}

function Node({ n, x, y }: { n: LineageNode; x: number; y: number }) {
  const Icon = ICON[n.kind] ?? Database;
  const self = n.role === "project";
  const label = n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name;
  return (
    <g data-lineage={`${n.kind}/${n.id}`} data-role={n.role}>
      <title>{`${copy.createMenu.kinds[n.kind] ?? n.kind}: ${n.name}`}</title>
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={8}
        fill={self ? "var(--color-primary)" : "var(--color-card)"}
        stroke={self ? "var(--color-primary)" : "var(--color-border)"}
      />
      <Icon
        x={x + 10}
        y={y + 10}
        width={14}
        height={14}
        color={
          self
            ? "var(--color-primary-foreground)"
            : "var(--color-muted-foreground)"
        }
        aria-hidden="true"
      />
      <text
        x={x + 30}
        y={y + 21}
        fontSize="12"
        fill={
          self ? "var(--color-primary-foreground)" : "var(--color-foreground)"
        }
      >
        {label}
      </text>
    </g>
  );
}

function AddNode({
  x,
  y,
  label,
  onClick,
  action,
}: {
  x: number;
  y: number;
  label: string;
  onClick: () => void;
  action: string;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="cursor-pointer"
      data-cartograph-action={action}
    >
      <title>{label}</title>
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={8}
        fill="transparent"
        stroke="var(--color-border)"
        strokeDasharray="4 3"
      />
      <Plus
        x={x + 10}
        y={y + 10}
        width={14}
        height={14}
        color="var(--color-muted-foreground)"
        aria-hidden="true"
      />
      <text
        x={x + 30}
        y={y + 21}
        fontSize="12"
        fill="var(--color-muted-foreground)"
      >
        {label}
      </text>
    </g>
  );
}
