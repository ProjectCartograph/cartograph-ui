import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { parseDocument, stringify } from "yaml";

import { useClient } from "@/client/context";
import { Help } from "@/components/guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecordDrawer } from "@/records/RecordDrawer";
import { slugify } from "@/definition/NewDefinition";
import { Label } from "@/components/ui/label";
import { copy } from "@/copy";
import { DirectorySelect } from "@/surfaces/sheet/DirectorySelect";

const c = copy.goals.editor.closesGap;

interface GapItem {
  id: string;
  name: string;
  spec?: { outcomes?: string[] };
}

/**
 * The gaps an outcome closes (engine TAXONOMY D24). The link is the gap's
 * (Gap.spec.outcomes), so a gap never points below itself; it is chosen
 * here, where the outcome is written, and saved on the gap, in the same
 * change set as every other edit.
 */
export function ClosesGaps({ outcome }: { outcome: string }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const gaps = useQuery({
    queryKey: ["manifests", "Gap", "expanded"],
    queryFn: async () => (await client.list("Gap", { expand: "spec" })) as GapItem[],
  });
  const closing = (gaps.data ?? []).filter((g) => g.spec?.outcomes?.includes(outcome));
  // Inside a walk, a new gap is named here and defined in the drawer,
  // already closing into this outcome.
  const drawer = useRecordDrawer();
  const [naming, setNaming] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async (name: string) => {
      const existing = new Set((gaps.data ?? []).map((g) => g.id));
      const base = slugify(name) || "gap";
      let id = base;
      for (let n = 2; existing.has(id); n++) id = `${base}-${n}`;
      await client.saveWorking("Gap", id, stringify({ apiVersion: "cartograph/v1", kind: "Gap", metadata: { id, name }, spec: { outcomes: [outcome] } }));
      return id;
    },
    onSuccess: (id) => {
      setNaming(null);
      void queryClient.invalidateQueries({ queryKey: ["manifests", "Gap"] });
      drawer?.open("Gap", id);
    },
  });
  const others = (gaps.data ?? []).filter((g) => !g.spec?.outcomes?.includes(outcome));

  const link = useMutation({
    mutationFn: async ({ gap, on }: { gap: string; on: boolean }) => {
      const view = await client.get("Gap", gap);
      const doc = parseDocument(view.yaml);
      const list = ((doc.getIn(["spec", "outcomes"]) as { toJSON(): string[] } | undefined)?.toJSON() ?? []).filter((o) => o !== outcome);
      doc.setIn(["spec", "outcomes"], on ? [...list, outcome] : list);
      if (!on && list.length === 0) doc.deleteIn(["spec", "outcomes"]);
      await client.saveWorking("Gap", gap, doc.toString());
    },
    onSuccess: () => void queryClient.invalidateQueries(),
  });

  return (
    <div id="goal-section-closesGap" className="flex flex-col gap-2" data-cartograph-field="/spec/closesGap">
      <div className="flex items-center gap-1">
        <Label>{c.label}</Label>
        <Help label={c.label} hint={c.hint} />
      </div>
      {closing.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {closing.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
              <TriangleAlert className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {drawer ? (
                <button type="button" onClick={() => drawer.open("Gap", g.id)} className="min-w-0 flex-1 truncate text-left hover:underline">
                  {g.name}
                </button>
              ) : (
                <Link to="/gaps/$id" params={{ id: g.id }} className="min-w-0 flex-1 truncate hover:underline">
                  {g.name}
                </Link>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={c.remove(g.name)}
                title={c.remove(g.name)}
                disabled={link.isPending}
                onClick={() => link.mutate({ gap: g.id, on: false })}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {others.length > 0 ? (
          <DirectorySelect
            data-cartograph-field="/spec/closesGap/-"
            kind="Gap"
            value=""
            onValueChange={(v) => v && link.mutate({ gap: v, on: true })}
            options={others.map((g) => ({ value: g.id, label: g.name }))}
            loading={gaps.isLoading}
            placeholder={c.choose}
            className="w-64 max-w-full"
          />
        ) : null}
        {drawer ? (
          naming === null ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setNaming("")} aria-label={c.addLabel} title={c.addLabel}>
              <Plus />
              {c.add}
            </Button>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (naming.trim()) create.mutate(naming.trim());
              }}
            >
              <Input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} aria-label={c.newName} className="w-56" />
              <Button type="submit" size="sm" disabled={!naming.trim() || create.isPending}>
                <Plus />
                {c.create}
              </Button>
            </form>
          )
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/gaps/new" search={{ outcome }} aria-label={c.addLabel} title={c.addLabel}>
              <Plus />
              {c.add}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
