import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";

import { holds, useSession } from "@/access/access";
import { useClient } from "@/client/context";
import { ClientError, type AgentGrant, type AgentToken } from "@/client/port";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copy } from "@/copy";

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const ac = copy.agents;

/**
 * The agents the signed-in person let act for them (engine
 * docs/adr/0016): how to connect one, and each one connected, to
 * disconnect. An administrator also sees everyone's.
 */
export function AgentsPage() {
  const { data: session } = useSession();
  const admin = holds(session, "administrator");
  const client = useClient();
  const [everyone, setEveryone] = useState(false);
  const address = client.mcpAddress();
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-cartograph-region="agents">
      <p className="text-sm text-muted-foreground">{ac.intro}</p>
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-medium">{ac.connect}</h2>
        <p className="text-sm text-muted-foreground">{ac.connectHow}</p>
        <CopyField value={address} />
        <PastedToken />
      </section>
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={everyone ? "outline" : "secondary"} onClick={() => setEveryone(false)}>
            {ac.yours}
          </Button>
          {admin ? (
            <Button size="sm" variant={everyone ? "secondary" : "outline"} onClick={() => setEveryone(true)}>
              {ac.everyone}
            </Button>
          ) : null}
        </div>
        <GrantList person={everyone ? "*" : undefined} />
      </section>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setCopied(true));
        }}
      >
        {copied ? ac.copied : ac.copyAddress}
      </Button>
    </div>
  );
}

/** A token to paste into a client with no browser flow, shown once. */
function PastedToken() {
  const client = useClient();
  const queries = useQueryClient();
  const [label, setLabel] = useState("");
  const [made, setMade] = useState<AgentToken | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const create = useMutation({
    mutationFn: () => client.createAgentToken(label.trim()),
    onSuccess: (t) => {
      setMade(t);
      setProblem(undefined);
      void queries.invalidateQueries({ queryKey: ["agent-grants"] });
    },
    onError: (e) => setProblem(e instanceof ClientError && e.status === 404 ? ac.tokensElsewhere : ac.failed),
  });
  return (
    <details className="pt-2 text-sm">
      <summary className="cursor-pointer text-muted-foreground">{ac.tokenTitle}</summary>
      <div className="mt-2 space-y-2">
        <p className="text-muted-foreground">{ac.tokenHint}</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input aria-label={ac.tokenLabel} placeholder={ac.tokenLabel} value={label} maxLength={64} onChange={(e) => setLabel(e.target.value)} />
          <Button type="submit" size="sm" disabled={!label.trim() || create.isPending}>
            {ac.create}
          </Button>
        </form>
        {made ? (
          <div className="space-y-1" data-cartograph-token>
            <p className="font-medium">{ac.tokenShown}</p>
            <CopyField value={made.token} />
          </div>
        ) : null}
        {problem ? <p className="text-destructive">{problem}</p> : null}
      </div>
    </details>
  );
}

function GrantList({ person }: { person?: string }) {
  const client = useClient();
  const list = useQuery({ queryKey: ["agent-grants", person ?? ""], queryFn: () => client.agentGrants(person) });
  if (list.isError) return <p className="text-sm text-destructive">{ac.loadFailed}</p>;
  if (list.data && list.data.length === 0) return <p className="text-sm text-muted-foreground">{ac.none}</p>;
  return (
    <ul className="space-y-2">
      {(list.data ?? []).map((g) => (
        <GrantRow key={g.id} grant={g} showPerson={person === "*"} />
      ))}
    </ul>
  );
}

function GrantRow({ grant: g, showPerson }: { grant: AgentGrant; showPerson: boolean }) {
  const client = useClient();
  const queries = useQueryClient();
  const revoke = useMutation({
    mutationFn: () => client.revokeAgentGrant(g.id),
    onSuccess: () => void queries.invalidateQueries({ queryKey: ["agent-grants"] }),
  });
  const ended = !!g.revokedAt || new Date(g.expiresAt) <= new Date();
  const detail = g.revokedAt
    ? ac.revoked(when.format(new Date(g.revokedAt)))
    : [
        ac.connected(when.format(new Date(g.createdAt))),
        g.lastUsed ? ac.lastUsed(when.format(new Date(g.lastUsed))) : ac.neverUsed,
        ac.expires(when.format(new Date(g.expiresAt))),
      ].join(", ");
  return (
    <li className={`flex items-center justify-between gap-4 rounded-lg border p-3 ${ended ? "opacity-60" : ""}`} data-cartograph-agent-grant={g.id}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium">
          <Bot className="size-4" />
          {g.label}
          {showPerson ? <span className="font-normal text-muted-foreground">· {g.person}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {ended ? null : (
        <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate()}>
          {ac.disconnect}
        </Button>
      )}
    </li>
  );
}
