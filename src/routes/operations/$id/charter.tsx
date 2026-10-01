import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CharterView } from "@/charter/CharterView";
import { copy } from "@/copy";

export const Route = createFileRoute("/operations/$id/charter")({ component: Page });

const cc = copy.charter;

/** The operation's charter: what the service does, who runs it, how it is
 * measured, and which projects will hand over to it. */
function Page() {
  const { id } = Route.useParams();
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{cc.title}</h1>
          <p className="text-muted-foreground text-pretty">{cc.subtitle}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/operations/$id/service" params={{ id }}>
            <ArrowLeft />
            {cc.back}
          </Link>
        </Button>
      </div>
      <CharterView
        kind="Operation"
        id={id}
        fileName={id}
        empty={cc.empty}
      />
    </div>
  );
}
