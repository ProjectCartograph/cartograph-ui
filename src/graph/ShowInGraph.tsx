import { Link } from "@tanstack/react-router";
import { Waypoints } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copy } from "@/copy";

/** Opens the workspace graph on one element and what it connects to. */
export function ShowInGraph({ kind, id }: { kind: string; id: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/graph" search={{ focus: `${kind}/${id}` }}>
        <Waypoints />
        {copy.graph.showInGraph}
      </Link>
    </Button>
  );
}
