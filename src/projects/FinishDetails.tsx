import { useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PencilLine } from "lucide-react";

import { useClient } from "@/client/context";
import { useRecordDrawer } from "@/records/RecordDrawer";
import { copy } from "@/copy";
import { parseSpecFields } from "@/surfaces/sheet/schema";
import { SheetForm } from "@/surfaces/sheet/SheetForm";

type Kind = "Gap" | "Goal" | "BeneficiaryGroup";

/** Whether a record named in passing still lacks what defines it. */
function lacking(kind: Kind, spec: Record<string, unknown>): boolean {
  const has = (k: string) => typeof spec[k] === "string" && (spec[k] as string).trim() !== "";
  // A gap is defined by its two states; its statement is the evidence.
  if (kind === "Gap") return !(has("current") && has("desired"));
  if (kind === "Goal") return !has("objective");
  return !has("description");
}

const amber =
  "inline-flex max-w-full items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-sm font-medium text-warning-foreground ring-1 ring-warning/40 transition-colors duration-150 ease-standard hover:bg-warning/25 active:scale-[0.98]";

/**
 * A friendly prompt to finish the records this project names that were
 * named in passing while starting it (a gap, an outcome, a group with only
 * a name), shown where the project first shows them. Each opens the place
 * to finish it; nothing is required, and a finished one is not shown.
 */
export function FinishDetails({ kind, ids }: { kind: Kind; ids: string[] }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const drawer = useRecordDrawer();
  const docs = useQueries({ queries: ids.map((id) => ({ queryKey: ["finish", kind, id], queryFn: () => client.get(kind, id) })) });
  const todo = docs
    .map((q, i) => {
      const m = (q.data as unknown as { manifest?: { metadata?: { name?: string }; spec?: Record<string, unknown> } } | undefined)?.manifest;
      return m && lacking(kind, m.spec ?? {}) ? { id: ids[i], name: m.metadata?.name ?? ids[i] } : null;
    })
    .filter((x): x is { id: string; name: string } => x !== null);
  if (todo.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" data-slot="finish-details" data-kind={kind}>
      <p className="text-xs text-muted-foreground">{copy.start.finishHint}</p>
      <ul className="flex flex-wrap gap-1.5">
        {todo.map((t, n) => (
          <li key={t.id} className="cartograph-arrive" style={{ animationDelay: `${n * 40}ms` }}>
            {kind !== "BeneficiaryGroup" && drawer ? (
              <button type="button" className={amber} onClick={() => drawer.open(kind, t.id)} data-finish={t.id}>
                <PencilLine className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{copy.start.finish(t.name)}</span>
              </button>
            ) : kind === "BeneficiaryGroup" ? (
              <button type="button" className={amber} onClick={() => setEditing(t.id)} data-finish={t.id}>
                <PencilLine className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{copy.start.finish(t.name)}</span>
              </button>
            ) : (
              <Link to={(kind === "Gap" ? "/gaps/$id" : "/goals/$id") as never} params={{ id: t.id } as never} className={amber} data-finish={t.id}>
                <PencilLine className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{copy.start.finish(t.name)}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
      {editing ? (
        <EditInPlace
          kind={kind}
          id={editing}
          onClose={() => {
            // Finished or not, it is read again.
            void queryClient.invalidateQueries({ queryKey: ["finish", kind, editing] });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** A register's own short form for one record, opened where it is met. */
function EditInPlace({ kind, id, onClose }: { kind: string; id: string; onClose: () => void }) {
  const client = useClient();
  const schema = useQuery({ queryKey: ["schema", kind], queryFn: () => client.schema(kind) });
  const doc = useQuery({ queryKey: ["finish", kind, id], queryFn: () => client.get(kind, id) });
  const fields = useMemo(() => parseSpecFields(schema.data), [schema.data]);
  const m = (doc.data as unknown as { version?: { number: number }; manifest?: { metadata?: { name?: string }; spec?: Record<string, unknown> } } | undefined);
  if (!m?.manifest || fields.length === 0) return null;
  return (
    <SheetForm
      kind={kind}
      kindLabel={copy.sheets.kindsSingular[kind] ?? kind}
      fields={fields}
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      existing={{ id, name: m.manifest.metadata?.name ?? id, version: m.version?.number ?? 0, spec: m.manifest.spec ?? {} }}
    />
  );
}
