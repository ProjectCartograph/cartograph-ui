import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { GraphView } from "@/graph/GraphView";

const gc = copy.graph;

export const Route = createFileRoute("/graph")({
  // ?focus=Kind/id opens the graph on one element and what it touches.
  validateSearch: (search: Record<string, unknown>): { focus?: string } =>
    typeof search.focus === "string" && search.focus.includes("/") ? { focus: search.focus } : {},
  component: Page,
});

function Page() {
  const client = useClient();
  const { focus } = Route.useSearch();
  const { data, isLoading } = useQuery({ queryKey: ["graph"], queryFn: () => client.graph() });
  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold">{gc.title}</h1>
        <p className="text-sm text-muted-foreground">{gc.subtitle}</p>
      </div>
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{gc.loading}</p>
        ) : !data || data.nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{gc.empty}</p>
        ) : (
          // Keyed by the focus, so following a link to another element
          // starts the view on it.
          <GraphView key={focus ?? ""} graph={data} focus={focus} />
        )}
      </div>
    </div>
  );
}
