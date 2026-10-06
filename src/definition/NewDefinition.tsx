import { useState } from "react";
import { RequiredMarks } from "@/components/RequiredMarks";
import { AlreadyThere } from "@/components/AlreadyThere";
import { DidYouMean } from "@/components/DidYouMean";
import { FlowBack, FlowNav, FlowNext, WalkerQuestion } from "@/components/walker";
import { manifestLink } from "@/proposals/links";
import { useNavigate, type LinkProps } from "@tanstack/react-router";
import { stringify as stringifyYAML } from "yaml";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClient } from "@/client/context";
import { copy } from "@/copy";
import { ClientError } from "@/client/port";
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
  teamField,
  children,
  initialName,
  onCreated,
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
  /** Where the team picked here is written in the new spec, by JSON pointer. */
  teamField?: string;
  /** Any other question the kind asks before it exists, below the team. */
  children?: React.ReactNode;
  /** A name to start from: the one a placeholder held (TAXONOMY.md D31). */
  initialName?: string;
  /** Told the new id once it exists, before the walk opens. */
  onCreated?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const client = useClient();
  const { data: teams, isLoading: teamsLoading } = useReferenceOptions("Team");

  const [name, setName] = useState(initialName ?? "");
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
    try {
      await client.saveWorking(kind, id, stringifyYAML(body));
    } catch (e) {
      if (!(e instanceof ClientError)) throw e;
      setCreating(false);
      setError(errorLabel);
      return;
    }
    setCreating(false);
    onCreated?.(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: firstStep, params: { id } } as any);
  }

  return (
    // The walker's frame and words, as every flow has them: one question,
    // large, then what it needs, then Back and the way forward.
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col gap-8 pt-[6vh] pb-12" data-cartograph-region="new-definition">
      <WalkerQuestion title={title} hint={subtitle} />
      <RequiredMarks kind={kind} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-definition-name">{nameLabel}</Label>
        <Input
          id="new-definition-name"
          data-cartograph-field="/metadata/name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder}
          autoFocus
        />
        {/* Already there under another spelling: opened, not defined twice. */}
        <DidYouMean
          kind={kind}
          name={name}
          onUse={(m) => {
            const link = manifestLink({ kind: m.kind, manifestId: m.id });
            if (link) void navigate({ to: link.to, params: link.params } as never);
          }}
        />
        <AlreadyThere kind={kind} text={name} />
      </div>

      {needsTeam ? (
        <div className="flex flex-col gap-2">
          <Label>{teamLabel}</Label>
          <DirectorySelect
            kind="Team"
            data-cartograph-field={teamField}
            value={team}
            onValueChange={setTeam}
            options={teams?.options ?? []}
            loading={teamsLoading}
            placeholder={teamPlaceholder}
          />
        </div>
      ) : null}

      {children}

      <FlowNav>
        <FlowBack label={copy.projects.back} onClick={() => window.history.back()} />
        <FlowNext label={createLabel} onClick={handleCreate} disabled={!canCreate || creating} />
      </FlowNav>
    </div>
  );
}
