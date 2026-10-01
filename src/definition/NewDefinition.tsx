import { useState } from "react";
import { useNavigate, type LinkProps } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { stringify as stringifyYAML } from "yaml";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { client } from "@/api/client";
import { DirectorySelect } from "@/surfaces/sheet/DirectorySelect";
import { useReferenceOptions } from "@/surfaces/sheet/useReferenceOptions";

/** The id a name becomes. Matches the server's own slug helper, so an id
 * generated on either side of the wire comes out the same. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/**
 * The door into a definition: a name and the team behind it, nothing else.
 *
 * Until 2026-09-29 only a project had one. A programme or an operation
 * could be walked through step by step, but only if somebody had already
 * written its file by hand — so the interface could edit twenty-nine
 * programmes and define none (Programme Lead, 2026-09-29).
 *
 * What it writes is a draft, staged and not yet in the vault. Naming a
 * thing is not deciding to keep it, and the save at the end of the walk is
 * where that is decided.
 */
export function NewDefinition({
  kind,
  teamLabel,
  teamPlaceholder,
  title,
  subtitle,
  nameLabel,
  namePlaceholder,
  createLabel,
  errorLabel,
  specFrom,
  firstStep,
}: {
  kind: string;
  /** Left out for a kind that belongs to nobody. A Gap is a finding about
   * the system, and asking who owns it invites one written as somebody's
   * missing budget line rather than as a short result. */
  teamLabel?: string;
  teamPlaceholder?: string;
  title: string;
  subtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  createLabel: string;
  errorLabel: string;
  /** The spec a new definition of this kind starts from. */
  specFrom: (name: string, team: string) => Record<string, unknown>;
  /** The step the walk opens on. */
  firstStep: LinkProps["to"];
}) {
  const navigate = useNavigate();
  const { data: teams, isLoading: teamsLoading } = useReferenceOptions("Team");

  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const id = slugify(name);
  const needsTeam = Boolean(teamLabel);
  const canCreate = name.trim() !== "" && (!needsTeam || !!team) && !!id;

  async function handleCreate() {
    setCreating(true);
    setError(null);
    const body = {
      apiVersion: "cartograph/v1",
      kind,
      metadata: { id, name: name.trim() },
      spec: specFrom(name.trim(), team),
    };
    const { error: err } = await client.PUT("/manifests/{kind}/{id}/working", {
      params: { path: { kind, id } },
      body: { yaml: stringifyYAML(body) },
    });
    setCreating(false);
    if (err) {
      setError(errorLabel);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: firstStep, params: { id } } as any);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-definition-name">{nameLabel}</Label>
        <Input
          id="new-definition-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder}
          autoFocus
        />
      </div>

      {needsTeam ? (
        <div className="flex flex-col gap-2">
          <Label>{teamLabel}</Label>
          <DirectorySelect
            kind="Team"
            value={team}
            onValueChange={setTeam}
            options={teams?.options ?? []}
            loading={teamsLoading}
            placeholder={teamPlaceholder}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" size="lg" onClick={handleCreate} disabled={!canCreate || creating}>
          {createLabel}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
