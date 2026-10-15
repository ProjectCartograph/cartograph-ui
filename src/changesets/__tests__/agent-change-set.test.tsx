/// <reference types="@testing-library/jest-dom" />
// An agent's change set, open while it works, read by its person: the
// page renders though a charter part comes back with no lines, a part
// that cannot be drawn fails alone, and a record only the change set
// holds opens in it (cartograph-ui#124).

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { activeChangeSet } from "@/client/active";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { ChangeSetReview, CharterPartDiff } from "@/client/port";
import { copy } from "@/copy";
import { ChangeSetPage } from "../ChangeSetPage";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <a href="#" onClick={(e) => (e.preventDefault(), onClick?.())}>
      {children}
    </a>
  ),
}));

const review: ChangeSetReview = {
  changeSet: { id: "cs-agent", title: "Customer analytics", status: "open", agent: "Claude Code", for: "ada@example.org", at: "2026-10-15T09:00:00Z", updated: "2026-10-15T09:30:00Z" },
  items: [{ kind: "Project", id: "project-cf86", name: "Customer analytics service", base: 0, proposed: "new", included: true, changes: [{ path: "/metadata/name", op: "add", to: "Customer analytics service" }], checks: [] }],
};

function mount(parts: CharterPartDiff[], mine = true) {
  const client = fakeClient({
    changeSet: async () => review,
    changeSets: async () => (mine ? [review.changeSet] : []),
    changeSetCharter: async () => parts,
    session: async () => ({ actor: "ada@example.org", email: "ada@example.org", canWrite: true }) as never,
  });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ChangeSetPage id="cs-agent" />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

afterEach(() => activeChangeSet.set(undefined));

describe("an agent's open change set", () => {
  it("renders a charter part that comes back with no lines", async () => {
    mount([
      { title: "At a glance", state: "added", lines: null as never },
      { title: "Scope", state: "added", lines: [{ op: "added", text: "Six depots" }] },
    ]);
    expect(await screen.findByRole("heading", { name: "Customer analytics" })).toBeInTheDocument();
    expect(await screen.findByRole("article", { name: "At a glance" })).toBeInTheDocument();
    expect(screen.getByText("Six depots")).toBeInTheDocument();
  });

  it("keeps the page when one part cannot be drawn", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mount([
      { title: "Broken", state: "added", lines: [{ op: "added", text: { not: "text" } as never }] },
      { title: "Scope", state: "added", lines: [{ op: "added", text: "Six depots" }] },
    ]);
    expect(await screen.findByText(copy.changeSets.preview.partFailed)).toBeInTheDocument();
    expect(screen.getByText("Six depots")).toBeInTheDocument();
  });

  it("opens a record it creates in it, for the person it works for", async () => {
    mount([]);
    const projects = await screen.findByRole("region", { name: copy.graph.kind.Project });
    fireEvent.click(within(projects).getByRole("button", { name: /Customer analytics service/ }));
    fireEvent.click(await within(projects).findByRole("link", { name: copy.changeSets.openRecord }));
    expect(activeChangeSet.get()).toBe("cs-agent");
  });

  it("offers no way into a new record to someone who cannot work in it", async () => {
    mount([], false);
    const projects = await screen.findByRole("region", { name: copy.graph.kind.Project });
    fireEvent.click(within(projects).getByRole("button", { name: /Customer analytics service/ }));
    expect(within(projects).queryByRole("link", { name: copy.changeSets.openRecord })).toBeNull();
  });
});
