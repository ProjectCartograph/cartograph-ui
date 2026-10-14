/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { activeChangeSet } from "@/client/active";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { ChangeSet } from "@/client/port";
import { copy } from "@/copy";
import { DraftsPage } from "../DraftsPage";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: ReactNode }) => <a href="#">{children}</a> }));

const dc = copy.drafts;
const set = (id: string, title: string, status: ChangeSet["status"], who = "ada@example.org"): ChangeSet =>
  ({ id, title, status, for: who, at: "2026-10-12T09:00:00Z", updated: "2026-10-12T09:30:00Z" }) as ChangeSet;

// Every edit lands in a draft: a project started and left is found on the
// drafts page, the one this window works in marked; an administrator also
// sees whose the other drafts are.
describe("the drafts page", () => {
  it("lists the person's open work, and everyone else's for an administrator", async () => {
    activeChangeSet.set("cs-here");
    const client = fakeClient({
      session: async () => ({ actor: "ada@example.org", canWrite: true, access: { roles: ["administrator"], listed: true, scopes: {}, reach: [] } }) as never,
      changeSets: async (opts) =>
        opts?.everyone
          ? [set("cs-here", "Depot checks", "open"), set("cs-ben", "Grading pack", "open", "ben@example.org")]
          : [set("cs-here", "Depot checks", "open"), set("cs-old", "Older work", "open"), set("cs-done", "Merged work", "merged")],
    });
    render(
      <ClientProvider client={client}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DraftsPage />
        </QueryClientProvider>
      </ClientProvider>,
    );
    const yours = await screen.findByRole("region", { name: dc.yours });
    expect(await within(yours).findByText("Depot checks")).toBeInTheDocument();
    expect(within(yours).getByText("Older work")).toBeInTheDocument();
    expect(within(yours).queryByText("Merged work")).toBeNull();
    expect(within(yours).getByText(dc.here)).toBeInTheDocument();
    expect(within(yours).getByRole("button", { name: dc.workInTitle("Older work") })).toBeInTheDocument();
    const theirs = await screen.findByRole("region", { name: dc.theirs("ben@example.org") });
    expect(within(theirs).getByText("Grading pack")).toBeInTheDocument();
    activeChangeSet.set(undefined);
  });
});
