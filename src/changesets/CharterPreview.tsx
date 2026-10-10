import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { useClient } from "@/client/context";
import type { CharterPartDiff } from "@/client/port";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy";

const pc = copy.changeSets.preview;

/**
 * The charter a change set leaves each of its projects with, overlaid
 * with what it changes (engine issue 30): parts new, removed or changed
 * marked, lines added in green and removed struck through in red, parts
 * the change set leaves alone folded away. The diff is the engine's; this
 * only draws it.
 */
export function CharterPreview({ set, projects }: { set: string; projects: { id: string; name: string }[] }) {
  const [at, setAt] = useState(0);
  if (projects.length === 0) return null;
  const project = projects[Math.min(at, projects.length - 1)];
  return (
    <section className="space-y-3 rounded-lg border p-4" data-cartograph-region="charter-preview" aria-labelledby="charter-preview-heading">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="charter-preview-heading" className="font-medium">
          {pc.heading}
        </h2>
      </div>
      <p className="max-w-[70ch] text-sm text-muted-foreground">{pc.intro}</p>
      {projects.length > 1 ? (
        <div role="tablist" aria-label={pc.project} className="flex flex-wrap gap-1">
          {projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === project.id}
              onClick={() => setAt(i)}
              className={`rounded-md px-2.5 py-1 text-sm ${p.id === project.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}
      <ProjectCharter key={project.id} set={set} project={project.id} />
    </section>
  );
}

function ProjectCharter({ set, project }: { set: string; project: string }) {
  const client = useClient();
  const [showSame, setShowSame] = useState(false);
  const diff = useQuery({ queryKey: ["changeset-charter", set, project], queryFn: () => client.changeSetCharter(set, project) });
  if (diff.isLoading) return <Skeleton className="h-48 w-full" />;
  if (diff.isError || !diff.data || diff.data.length === 0) return <p className="text-sm text-muted-foreground">{pc.none}</p>;
  const same = diff.data.filter((p) => p.state === "same").length;
  return (
    <div className="space-y-3" data-cartograph-charter={project}>
      {diff.data.map((p, i) => (p.state === "same" && !showSame ? null : <Part key={`${p.title}-${i}`} part={p} />))}
      {same > 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{pc.sameCount(same)}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSame((s) => !s)}>
            {showSame ? pc.hideSame : pc.showSame}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const stateRing: Record<string, string> = {
  added: "border-success/50",
  removed: "border-destructive/50 opacity-80",
  changed: "border-changed/50",
  same: "",
};

function Part({ part }: { part: CharterPartDiff }) {
  return (
    <article className={`rounded-md border p-3 ${stateRing[part.state] ?? ""}`} aria-label={part.title} data-part-state={part.state}>
      <header className="mb-1.5 flex items-center gap-2">
        <h3 className={`text-sm font-semibold ${part.state === "removed" ? "line-through decoration-destructive/50" : ""}`}>{part.title}</h3>
        {part.state !== "same" ? (
          <Badge variant="outline" className="font-normal">
            {pc.state[part.state]}
          </Badge>
        ) : null}
      </header>
      <ul className="space-y-0.5 text-sm">
        {part.lines.map((l, i) =>
          l.op === "added" ? (
            <li key={i} className="rounded bg-success/10 px-1.5 text-success" data-line-op="added">
              <ins className="no-underline" title={pc.added}>
                {l.text}
              </ins>
            </li>
          ) : l.op === "removed" ? (
            <li key={i} className="rounded bg-destructive/10 px-1.5 text-destructive" data-line-op="removed">
              <del className="decoration-destructive/50" title={pc.removed}>
                {l.text}
              </del>
            </li>
          ) : (
            <li key={i} className="px-1.5" data-line-op="same">
              {l.text}
            </li>
          ),
        )}
      </ul>
    </article>
  );
}
