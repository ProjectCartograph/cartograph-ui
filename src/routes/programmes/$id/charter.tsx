import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CharterView } from "@/charter/CharterView";
import { copy } from "@/copy";

export const Route = createFileRoute("/programmes/$id/charter")({ component: Page });

const cc = copy.charter;

/** The programme's charter: its aim, what is wrong, what it serves, how
 * it believes the change happens, what is inside it and who runs it. */
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
          <Link to="/programmes/$id/aim" params={{ id }}>
            <ArrowLeft />
            {cc.back}
          </Link>
        </Button>
      </div>
      <CharterView
        kind="Programme"
        id={id}
        fileName={id}
        empty={cc.empty}
      />
    </div>
  );
}
