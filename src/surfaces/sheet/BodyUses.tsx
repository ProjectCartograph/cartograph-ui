import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import { copy } from "@/copy";

type As = "confirms" | "receives" | "decided";
const ORDER: As[] = ["confirms", "receives", "decided"];

/**
 * What a governance body does across the workspace (TAXONOMY.md D43):
 * the success it confirms, the escalations it receives and the mandates it
 * issued, read from what references it. The engine names each place, so
 * this only groups and lists them.
 */
export function BodyUses({ id }: { id: string }) {
  const client = useClient();
  const { data } = useQuery({
    queryKey: ["references", "Resource", id],
    queryFn: () => client.references("Resource", id),
  });
  const c = copy.sheets.bodyUses;
  const uses = data?.uses ?? [];
  const groups = ORDER.map((as) => ({
    as,
    names: [...new Set(uses.filter((u) => u.as === as).map((u) => u.name || u.id))],
  })).filter((g) => g.names.length > 0);

  return (
    <section className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3 text-sm" data-cartograph-region="body-uses">
      <h3 className="font-medium">{c.title}</h3>
      {groups.length === 0 ? (
        <p className="text-muted-foreground">{c.none}</p>
      ) : (
        groups.map((g) => (
          <div key={g.as} data-slot={`body-${g.as}`}>
            <p className="text-xs text-muted-foreground">{c[g.as]}</p>
            <p>{g.names.join(", ")}</p>
          </div>
        ))
      )}
    </section>
  );
}
