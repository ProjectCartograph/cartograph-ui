import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CharterView } from "@/charter/CharterView";
import { ProjectLiveCharter } from "@/projects/InitiationShell";
import { copy } from "@/copy";

export const Route = createFileRoute("/projects/$id/charter")({ component: Page });

const cc = copy.charter;

/** The project's own charter, rendered by the server from the working
 * copy so it says what the definition says right now. */
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
          <Link to="/projects/$id" params={{ id }}>
            <ArrowLeft />
            {cc.back}
          </Link>
        </Button>
      </div>
      {/* The charter edited in place, as a document is: click what it
          says to change it (#38). The PDF and the tab print the engine's
          renderer, the same text. */}
      <div data-cartograph-region="charter">
        <CharterView kind="Project" id={id} working fileName={id} empty={cc.empty} live={<ProjectLiveCharter id={id} />} />
      </div>
    </div>
  );
}
