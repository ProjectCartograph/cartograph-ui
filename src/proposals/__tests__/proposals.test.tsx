/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { ClientError, type Client, type Proposal, type ProposalReview } from "@/client/port";
import { copy } from "@/copy";

import { ProposalNotice } from "../ProposalNotice";
import { fieldLabel, ProposalReviewPage } from "../ProposalReviewPage";
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

const outcome: Proposal = {
  id: "p2",
  kind: "Goal",
  manifestId: "grading-disputes-fall",
  op: "save",
  manifest: { apiVersion: "cartograph/v1", kind: "Goal", metadata: { id: "grading-disputes-fall", name: "Grading disputes fall" } },
  reason: "a new outcome",
  agent: "Claude",
  for: "ada@example.org",
  base: 0,
  at: "2026-10-03T09:00:00Z",
  status: "open",
  waivers: [{ check: "owner", message: "No owner yet.", reason: "Ada has not decided who" }],
};

const review: ProposalReview = {
  proposal: outcome,
  parts: [{ proposal: outcome, changes: [
    { path: "/metadata/name", op: "add", to: "Grading disputes fall" },
    { path: "/spec/objective", op: "add", to: "Fewer members dispute their grade." },
  ],
  checks: [
    { id: "owner", state: "warn", message: "No owner yet.", section: "owner" },
    { id: "specific", state: "ok", message: "Says what changes." },
  ] }],
};

describe("proposals", () => {
  it("are listed to review, never accepted from the list", async () => {
    mount(fakeClient({ proposals: async () => [reading, outcome] }), <ProposalsPage />);
    const reviews = await screen.findAllByRole("link", { name: copy.proposals.review });
    expect(reviews).toHaveLength(2);
    expect(screen.queryByRole("button", { name: copy.proposals.accept })).toBeNull();
    expect(screen.getByText(copy.proposals.waivers(1))).toBeInTheDocument();
  });

  it("are read in full before they are accepted", async () => {
    const acceptProposal = vi.fn(async () => ({ ...outcome, status: "accepted" as const }));
    mount(fakeClient({ getProposal: async () => review, acceptProposal }), <ProposalReviewPage id="p2" />);
    expect(await screen.findByText(copy.proposals.changesNew)).toBeInTheDocument();
    expect(document.querySelector('[data-cartograph-change="/spec/objective"]')).toHaveTextContent("Fewer members dispute their grade.");
    expect(screen.getByText(copy.leftOpen.heading)).toBeInTheDocument();
    expect(screen.getByText("Ada has not decided who")).toBeInTheDocument();
    expect(document.querySelector('[data-cartograph-check="owner"]')).toHaveTextContent("No owner yet.");
    expect(screen.getByRole("link", { name: copy.proposals.openDraft })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: copy.proposals.accept }));
    await waitFor(() => expect(acceptProposal).toHaveBeenCalledWith("p2"));
  });

  it("show every part of a set, decided together", async () => {
    const gap: Proposal = { ...outcome, id: "p3", kind: "Gap", manifestId: "members-dispute-grades", set: "s1", waivers: undefined };
    const set: ProposalReview = {
      proposal: { ...outcome, set: "s1" },
      parts: [
        { proposal: gap, changes: [{ path: "/spec/current", op: "add", to: "One delivery in eight is disputed." }], checks: [] },
        { ...review.parts[0], proposal: { ...outcome, set: "s1" } },
      ],
    };
    const acceptProposal = vi.fn(async () => ({ ...outcome, status: "accepted" as const }));
    mount(fakeClient({ getProposal: async () => set, acceptProposal }), <ProposalReviewPage id="p2" />);
    expect(await screen.findByText(copy.proposals.setTitle(2))).toBeInTheDocument();
    expect(screen.getByText(copy.proposals.together)).toBeInTheDocument();
    expect(document.querySelector('[data-cartograph-part="Gap/members-dispute-grades"]')).toHaveTextContent("One delivery in eight is disputed.");
    expect(screen.getAllByRole("link", { name: copy.proposals.openDraft })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: copy.proposals.accept })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: copy.proposals.accept }));
    await waitFor(() => expect(acceptProposal).toHaveBeenCalledWith("p2"));
  });

  it("say so when the manifest changed since the agent proposed", async () => {
    const acceptProposal = vi.fn(async (): Promise<Proposal> => {
      throw new ClientError(409, [{ message: "changed" }]);
    });
    mount(fakeClient({ getProposal: async () => review, acceptProposal }), <ProposalReviewPage id="p2" />);
    await userEvent.click(await screen.findByRole("button", { name: copy.proposals.accept }));
    expect(await screen.findByText(copy.proposals.stale)).toBeInTheDocument();
  });

  it("are declined", async () => {
    const declineProposal = vi.fn(async () => ({ ...outcome, status: "declined" as const }));
    mount(fakeClient({ getProposal: async () => review, declineProposal }), <ProposalReviewPage id="p2" />);
    await userEvent.click(await screen.findByRole("button", { name: copy.proposals.decline }));
    await waitFor(() => expect(declineProposal).toHaveBeenCalledWith("p2"));
  });

  it("offer no decision once decided", async () => {
    const decided = { ...review, proposal: { ...outcome, status: "accepted" as const, decidedBy: "ada@example.org" } };
    mount(fakeClient({ getProposal: async () => decided }), <ProposalReviewPage id="p2" />);
    expect(await screen.findByText(copy.proposals.decided("accepted", "ada@example.org"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.proposals.accept })).toBeNull();
  });

  it("name fields as a person reads them", () => {
    expect(fieldLabel("/spec/keyResults/0/target")).toBe("Key results › 1 › Target");
    expect(fieldLabel("/metadata/name")).toBe("Metadata › Name");
  });

  it("show on the manifest they concern, for everyone who reads it", async () => {
    const proposals = vi.fn(async () => [reading]);
    mount(fakeClient({ proposals }), <ProposalNotice kind="KPIReadings" id="k1-readings" />);
    await waitFor(() => expect(document.querySelector('[data-cartograph-region="proposal-notice"]')).not.toBeNull());
    expect(proposals).toHaveBeenCalledWith({ kind: "KPIReadings", id: "k1-readings" });
  });
});
