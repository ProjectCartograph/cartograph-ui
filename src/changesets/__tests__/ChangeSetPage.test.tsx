/// <reference types="@testing-library/jest-dom" />
// A change set is reviewed in one place, like a pull request: grouped by
// kind, each record's changes and checks, trimmed, then accepted whole.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { ChangeSetReview } from "@/client/port";
import { copy } from "@/copy";
import { ChangeSetPage } from "../ChangeSetPage";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="#">{children}</a>,
}));

const cc = copy.changeSets;

const review: ChangeSetReview = {
  changeSet: { id: "cs1", title: "Define the bruising gap", status: "proposed", agent: "Claude Code", for: "ada@example.org", at: "2026-10-03T09:00:00Z", updated: "2026-10-03T09:30:00Z", reason: "From the spring quality review" },
  items: [
    { kind: "Gap", id: "gap-bruise", name: "Bruised on arrival", base: 0, included: true, changes: [{ path: "/spec/current", op: "add", to: "One crate in five" }], checks: [{ id: "gap-measured", state: "warn", message: "No indicator tracks this gap yet." }] },
    { kind: "Goal", id: "o-sound", name: "Fruit arrives sound", base: 2, included: true, changes: [{ path: "/spec/objective", op: "replace", from: "Less loss", to: "Fruit arrives sound" }], checks: [{ id: "owner", state: "ok", message: "Owner named." }] },
    { kind: "KPI", id: "k-sound", name: "Sound on arrival", base: 1, included: true, stale: 2, changes: [], checks: [] },
  ],
};

function mount(over: Parameters<typeof fakeClient>[0] = {}) {
  const client = fakeClient({
    changeSet: async () => review,
    session: async () => ({ actor: "ada@example.org", email: "ada@example.org", canWrite: true }) as never,
    ...over,
  });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ChangeSetPage id="cs1" />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

describe("a change set's review", () => {
  it("groups its records by kind, with what each changes and still lacks", async () => {
    mount();
    expect(await screen.findByRole("heading", { name: "Define the bruising gap" })).toBeInTheDocument();
    const summary = document.querySelector('[data-cartograph-region="change-set-summary"]')!;
    expect(within(summary as HTMLElement).getByText(copy.graph.kind.Gap)).toBeInTheDocument();
    const gaps = screen.getByRole("region", { name: copy.graph.kind.Gap });
    fireEvent.click(within(gaps).getByRole("button", { name: /Bruised on arrival/ }));
    expect(within(gaps).getByText("One crate in five")).toBeInTheDocument();
    expect(within(gaps).getByText("No indicator tracks this gap yet.")).toBeInTheDocument();
    // A record saved since it started says so.
    expect(screen.getByText(cc.stale(2))).toBeInTheDocument();
  });

  it("trims a record, and accepts the rest whole", async () => {
    const includeChangeSetItem = vi.fn(async () => undefined);
    const acceptChangeSet = vi.fn(async () => review.changeSet);
    mount({ includeChangeSetItem, acceptChangeSet });
    await screen.findByRole("heading", { name: "Define the bruising gap" });
    await waitFor(() => expect(screen.getByRole("checkbox", { name: `${cc.include}: Sound on arrival` })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: `${cc.include}: Sound on arrival` }));
    await waitFor(() => expect(includeChangeSetItem).toHaveBeenCalledWith("cs1", "KPI", "k-sound", false));
    fireEvent.click(screen.getByRole("button", { name: copy.mergeBar.mergeLabel }));
    // What is still open is shown before it merges.
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: copy.mergeBar.mergeLabel }));
    await waitFor(() => expect(acceptChangeSet).toHaveBeenCalledWith("cs1"));
  });

  it("offers nothing to decide to anyone but its person", async () => {
    mount({ session: async () => ({ actor: "sam@example.org", email: "sam@example.org", canWrite: true }) as never });
    await screen.findByRole("heading", { name: "Define the bruising gap" });
    expect(screen.queryByRole("button", { name: copy.mergeBar.mergeLabel })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("hands an open change set of mine to an agent, by its id", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    mount({ changeSet: async () => ({ ...review, changeSet: { ...review.changeSet, status: "open", agent: undefined } }) });
    fireEvent.click(await screen.findByRole("button", { name: copy.askAgent.label }));
    fireEvent.click(await screen.findByRole("button", { name: copy.askAgent.copyLabel }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(copy.askAgent.request("Define the bruising gap", "cs1")));
    expect(await screen.findByText(copy.askAgent.copied)).toBeInTheDocument();
  });

  it("offers no agent on a change set already proposed", async () => {
    mount();
    await screen.findByRole("heading", { name: "Define the bruising gap" });
    expect(screen.queryByRole("button", { name: copy.askAgent.label })).not.toBeInTheDocument();
  });
});
