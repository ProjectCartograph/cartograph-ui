import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { stringify as stringifyYAML } from "yaml";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aliasFor } from "@/alias";
import { AlreadyThere } from "@/components/AlreadyThere";
import { useClient } from "@/client/context";
import { ClientError } from "@/client/port";
import { copy } from "@/copy";
import { DirectorySelect } from "@/surfaces/sheet/DirectorySelect";
import { ReferencePicker } from "@/surfaces/sheet/ReferencePicker";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";
import type { ProjectManifest } from "@/projects/types";

export const Route = createFileRoute("/projects/new")({
  component: NewProjectPage,
  // Arriving from "What are you describing?" as a component of a bigger
  // project (TAXONOMY.md D14, D15).
  // Arriving from a planned service, the project that sets it up lands in
  // it (TAXONOMY.md D30).
  validateSearch: (search: Record<string, unknown>): { partOf?: boolean; operation?: string; name?: string; about?: string; idea?: string } => ({
    // The idea, from preparing (TAXONOMY.md D34): what it is about.
    ...(typeof search.about === "string" && search.about ? { about: search.about.slice(0, 300) } : {}),
    ...(typeof search.idea === "string" && search.idea ? { idea: search.idea.slice(0, 1000) } : {}),
    ...(typeof search.name === "string" && search.name ? { name: search.name } : {}),
    ...(search.partOf === true || search.partOf === "true" ? { partOf: true } : {}),
    ...(typeof search.operation === "string" && search.operation ? { operation: search.operation } : {}),
  }),
});

const nc = copy.projects.newProject;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/**
 * The first view: a name and the team behind it, nothing else. The goal
 * tree used to sit here too, which made the same picker appear twice and
 * put alignment before anyone had said what the project was for. Goals and
 * measures is the one canonical place a project is aligned; this screen
 * only opens the door.
 */
function NewProjectPage() {
  const navigate = useNavigate();
  const client = useClient();
  const { partOf: isComponent, operation, name: typed, about, idea } = Route.useSearch();
  const { data: teams, isLoading: teamsLoading } = useReferenceOptions("Team");
  const [parent, setParent] = useState<string | undefined>(undefined);

  const [name, setName] = useState(typed ?? "");
  const [team, setTeam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const id = slugify(name);
  const canCreate = name.trim() !== "" && !!team && !!id && (!isComponent || !!parent);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    const body: ProjectManifest = {
      apiVersion: "cartograph/v1",
      kind: "Project",
      // The alias is the reference people quote; it starts as the name's
      // own slug and is theirs to change on the record afterwards.
      metadata: { id, name: name.trim(), alias: aliasFor(name) },
      spec: {
        summary: { ...(about ? { about } : {}), ...(idea ? { idea } : {}), problems: [{ problem: {}, change: {} }] },
        team,
        ...(isComponent && parent ? { alignment: { partOf: parent } } : {}),
        ...(operation ? { operation } : {}),
      },
    };
    let saved = true;
    try {
      await client.saveWorking("Project", id, stringifyYAML(body));
    } catch (e) {
      if (!(e instanceof ClientError)) throw e;
      saved = false;
    }
    setCreating(false);
    if (saved) {
      // A definition opens on Align: what larger goals this is part of,
      // before what it is. The rest of the walk follows STEPS from there.
      void navigate({ to: "/projects/$id/initiation/goals", params: { id } });
      return;
    }
    setError(nc.generalError);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6" data-cartograph-region="new-project">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{isComponent ? nc.componentTitle : nc.title}</h1>
        <p className="text-muted-foreground">{isComponent ? nc.componentSubtitle : nc.subtitle}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isComponent ? (
        <div className="flex flex-col gap-2">
          <Label>{copy.projects.goals.parentLabel}</Label>
          <ReferencePicker
            data-cartograph-field="/spec/alignment/partOf"
            refKind="Project"
            value={parent}
            onChange={setParent}
            placeholder={copy.projects.goals.parentPlaceholder}
            label={copy.projects.goals.parentLabel}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label>{nc.nameLabel}</Label>
        <Input data-cartograph-field="/metadata/name" value={name} onChange={(e) => setName(e.target.value)} placeholder={nc.namePlaceholder} autoFocus />
        <AlreadyThere kind="Project" text={name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{nc.teamLabel}</Label>
        <DirectorySelect
          data-cartograph-field="/spec/team"
          kind="Team"
          value={team}
          onValueChange={setTeam}
          options={teams?.options ?? []}
          loading={teamsLoading}
          placeholder={nc.teamPlaceholder}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" size="lg" onClick={handleCreate} disabled={!canCreate || creating}>
          {nc.create}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
