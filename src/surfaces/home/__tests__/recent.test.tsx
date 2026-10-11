/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { Recent } from "../Recent";
import { noteVisit, recentVisits, recordOf } from "../recent";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>, useRouterState: () => "/" }));

beforeEach(() => localStorage.clear());

// Home shows what this person opened last, one click away (#58).
describe("what was opened last", () => {
  it("reads a record from its route, and keeps the last first, once each", () => {
    expect(recordOf("/projects/p1/initiation/scope")).toEqual({ kind: "Project", id: "p1" });
    expect(recordOf("/projects/start")).toBeUndefined();
    expect(recordOf("/sheets/Team")).toBeUndefined();
    noteVisit("Project", "p1", 1);
    noteVisit("KPI", "k1", 2);
    noteVisit("Project", "p1", 3);
    expect(recentVisits().map((v) => `${v.kind}/${v.id}`)).toEqual(["Project/p1", "KPI/k1"]);
  });

  it("lists them on Home by name, leaving out any no longer there", async () => {
    noteVisit("Gap", "gone", Date.now());
    noteVisit("Project", "p1", Date.now());
    const get = vi.fn(async (_k: string, id: string) => {
      if (id === "gone") throw new Error("not found");
      return { version: { number: 1 }, manifest: { metadata: { id, name: "Depot checks" } }, yaml: "" };
    });
    render(
      <ClientProvider client={fakeClient({ get: get as never })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Recent />
        </QueryClientProvider>
      </ClientProvider>,
    );
    expect(await screen.findByText("Depot checks")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: copy.home.recent.title })).toBeInTheDocument();
  });
});
