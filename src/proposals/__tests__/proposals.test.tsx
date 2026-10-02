/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { ClientError, type Client, type Proposal } from "@/client/port";
import { copy } from "@/copy";

import { ProposalNotice } from "../ProposalNotice";
import { ProposalsPage } from "../ProposalsPage";

const reading: Proposal = {
  id: "p1",
  kind: "KPIReadings",
  manifestId: "k1-readings",
  op: "append",
  series: "readings",
  item: { period: "2026-09", value: 41 },
  reason: "the September figure, from the depot report",
  agent: "Claude",
  for: "ada@example.org",
  base: 4,
  at: "2026-10-03T09:00:00Z",
  status: "open",
};

/** Mounts ui under a router, which its links need. */
function mount(client: Client, ui: ReactNode) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const page = createRoute({ getParentRoute: () => root, path: "/", component: () => <>{ui}</> });
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("proposals", () => {
  it("are accepted by their person, and leave the list", async () => {
    let open = [reading];
    const acceptProposal = vi.fn(async () => {
      open = [];
      return { ...reading, status: "accepted" as const };
    });
    mount(fakeClient({ proposals: async () => open, acceptProposal }), <ProposalsPage />);
    const accept = await screen.findByRole("button", { name: copy.proposals.accept });
    await userEvent.click(accept);
    await waitFor(() => expect(acceptProposal).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(document.querySelector('[data-cartograph-proposal="p1"]')).toBeNull());
  });

  it("say so when the manifest changed since the agent proposed", async () => {
    const acceptProposal = vi.fn(async (): Promise<Proposal> => {
      throw new ClientError(409, [{ message: "changed" }]);
    });
    mount(fakeClient({ proposals: async () => [reading], acceptProposal }), <ProposalsPage />);
    await userEvent.click(await screen.findByRole("button", { name: copy.proposals.accept }));
    expect(await screen.findByText(copy.proposals.stale)).toBeInTheDocument();
  });

  it("are declined", async () => {
    const declineProposal = vi.fn(async () => ({ ...reading, status: "declined" as const }));
    mount(fakeClient({ proposals: async () => [reading], declineProposal }), <ProposalsPage />);
    await userEvent.click(await screen.findByRole("button", { name: copy.proposals.decline }));
    await waitFor(() => expect(declineProposal).toHaveBeenCalledWith("p1"));
  });

  it("show on the manifest they concern, for everyone who reads it", async () => {
    const proposals = vi.fn(async () => [reading]);
    mount(fakeClient({ proposals }), <ProposalNotice kind="KPIReadings" id="k1-readings" />);
    await waitFor(() => expect(document.querySelector('[data-cartograph-region="proposal-notice"]')).not.toBeNull());
    expect(proposals).toHaveBeenCalledWith({ kind: "KPIReadings", id: "k1-readings" });
  });
});
