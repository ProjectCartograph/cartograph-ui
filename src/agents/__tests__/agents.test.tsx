/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { ClientError, type AgentGrant, type Client, type Session } from "@/client/port";
import { copy } from "@/copy";

import { AgentsPage } from "../AgentsPage";

const lee: Session = {
  actor: "sub-lee",
  name: "Lee Okafor",
  email: "lee@example.org",
  canWrite: true,
  access: { listed: true, roles: ["contributor"], teams: ["curriculum"], reach: ["curriculum"], scopes: { Project: "teams" }, agents: true },
};
const ada: Session = { ...lee, email: "ada@example.org", access: { ...lee.access!, roles: ["administrator", "contributor"] } };

const claude: AgentGrant = {
  id: "g1",
  person: "lee@example.org",
  label: "Claude",
  createdAt: "2026-10-01T09:00:00Z",
  expiresAt: "2099-01-01T00:00:00Z",
  lastUsed: "2026-10-02T09:00:00Z",
};

function mount(client: Client) {
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AgentsPage />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("agents", () => {
  it("are listed for their person, who disconnects one", async () => {
    let grants = [claude];
    const revokeAgentGrant = vi.fn(async () => {
      grants = [{ ...claude, revokedAt: "2026-10-03T09:00:00Z" }];
    });
    mount(fakeClient({ session: async () => lee, agentGrants: async () => grants, revokeAgentGrant }));
    await userEvent.click(await screen.findByRole("button", { name: copy.agents.disconnect }));
    await waitFor(() => expect(revokeAgentGrant).toHaveBeenCalledWith("g1"));
    await waitFor(() => expect(document.querySelector('[data-cartograph-agent-grant="g1"]')).toHaveTextContent("Disconnected"));
    expect(screen.queryByRole("button", { name: copy.agents.disconnect })).toBeNull();
    // Only an administrator sees everyone's.
    expect(screen.queryByRole("button", { name: copy.agents.everyone })).toBeNull();
  });

  it("show a pasted token once", async () => {
    const createAgentToken = vi.fn(async () => ({ grant: { ...claude, id: "g2", label: "A script" }, token: "cga_token" }));
    mount(fakeClient({ session: async () => lee, agentGrants: async () => [], createAgentToken }));
    await userEvent.click(screen.getByText(copy.agents.tokenTitle));
    await userEvent.type(screen.getByLabelText(copy.agents.tokenLabel), "A script");
    await userEvent.click(screen.getByRole("button", { name: copy.agents.create }));
    await waitFor(() => expect(createAgentToken).toHaveBeenCalledWith("A script"));
    expect(await screen.findByDisplayValue("cga_token")).toBeInTheDocument();
  });

  it("say so where the deployment's own sign-in authorizes agents", async () => {
    const createAgentToken = vi.fn(async () => {
      throw new ClientError(404, [{ message: "not here" }]);
    });
    mount(fakeClient({ session: async () => lee, agentGrants: async () => [], createAgentToken }));
    await userEvent.click(screen.getByText(copy.agents.tokenTitle));
    await userEvent.type(screen.getByLabelText(copy.agents.tokenLabel), "A script");
    await userEvent.click(screen.getByRole("button", { name: copy.agents.create }));
    expect(await screen.findByText(copy.agents.tokensElsewhere)).toBeInTheDocument();
  });

  it("are everyone's for an administrator who asks", async () => {
    const agentGrants = vi.fn(async (person?: string) => (person === "*" ? [claude, { ...claude, id: "g3", person: "sam@example.org" }] : []));
    mount(fakeClient({ session: async () => ada, agentGrants }));
    await userEvent.click(await screen.findByRole("button", { name: copy.agents.everyone }));
    await waitFor(() => expect(agentGrants).toHaveBeenCalledWith("*"));
    expect(await screen.findByText(/sam@example.org/)).toBeInTheDocument();
  });
});
