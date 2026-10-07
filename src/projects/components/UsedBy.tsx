import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { WorkRef } from "@/client/port";
import { copy } from "@/copy";
import { KIND_ICON, Marks, useComponentGraph } from "./ComponentsTable";

const cc = copy.projects.components;

/**
 * What depends on this work, read back from what lists it (TAXONOMY.md
 * D46). Only a link an older definition recorded here, on this work, can
 * be removed here; the rest belong to the work that lists it.
 */
export function UsedBy({ self, onRemoveOwn }: { self: WorkRef; onRemoveOwn: (kind: WorkRef["kind"], id: string) => void }) {
  const { data } = useComponentGraph();
  if (!data) return null;
  const at = new Map(data.nodes.map((n) => [`${n.kind}/${n.id}`, n]));
  const edges = data.edges.filter((e) => e.to.kind === self.kind && e.to.id === self.id);
  return (
    <div className="flex flex-col gap-1.5" data-slot="used-by">
      <span className="text-sm font-medium">{cc.usedBy}</span>
      {edges.length === 0 ? (
        <p className="text-sm text-muted-foreground">{cc.usedByNone}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {edges.map((e) => {
            const n = at.get(`${e.from.kind}/${e.from.id}`);
            if (!n) return null;
            const Icon = KIND_ICON[n.kind];
            return (
              <li
                key={`${n.kind}/${n.id}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-sm"
                title={e.legacy ? cc.declaredHere(n.name) : e.why}
                data-used-by={`${n.kind}/${n.id}`}
              >
                <Icon className="size-3.5 text-muted-foreground" role="img" aria-label={n.kind === "Project" ? cc.project : cc.programme} />
                {n.name}
                <Marks node={n} />
                {e.legacy ? (
                  <Button type="button" variant="ghost" size="icon" className="size-5" onClick={() => onRemoveOwn(n.kind, n.id)} aria-label={cc.stopPartOf(n.name)} title={cc.stopPartOf(n.name)}>
                    <X className="size-3" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
