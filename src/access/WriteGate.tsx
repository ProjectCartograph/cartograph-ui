import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Eye } from "lucide-react";

import { useClient } from "@/client/context";
import { NotFound } from "@/client/port";
import { copy } from "@/copy";

import { mayWrite, owningTeam, teamField, useSession } from "./access";

/**
 * A manifest's screen, or a kind's sheet when there is no id, editable or
 * not as the access list says. When the
 * session may not change it, every control inside is disabled (a disabled
 * fieldset disables all of them, however a screen builds its editors) and
 * a line says why. The engine refuses the write regardless; this keeps
 * people from typing into something that will not take.
 */
export function WriteGate({ kind, id, children }: { kind: string; id?: string; children: ReactNode }) {
  const client = useClient();
  const { data: session } = useSession();
  const owned = kind in teamField;
  const { data: team } = useQuery({
    queryKey: ["owning-team", kind, id],
    enabled: owned && !!id && session?.access?.scopes[kind] === "teams",
    queryFn: async () => {
      try {
        return owningTeam(kind, (await client.get(kind, id ?? "")).manifest.spec) ?? null;
      } catch (e) {
        if (e instanceof NotFound) return null; // a new one has no owner yet
        throw e;
      }
    },
  });
  if (mayWrite(session, kind, team ?? undefined)) return <>{children}</>;
  const theirs = session?.access?.scopes[kind] === "teams";
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground" data-cartograph-region="read-only">
        <Eye className="size-4 shrink-0" />
        {theirs ? copy.access.notYourTeam : copy.access.readOnly}
      </p>
      <fieldset disabled className="contents">
        {children}
      </fieldset>
    </div>
  );
}
