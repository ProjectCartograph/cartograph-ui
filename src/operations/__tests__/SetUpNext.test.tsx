import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { SetUpNext } from "../SetUpNext";

const sc = copy.operations.setUpNext;
let store: { id: string; spec: { status?: string }; staged: boolean };

vi.mock("@/definition/store", () => ({ useDefinitionStore: () => store }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search }: { children: ReactNode; to: string; search?: Record<string, string> }) => (
    <a href={search ? `${to}?${new URLSearchParams(search)}` : to}>{children}</a>
  ),
}));

function mount(projects: string[]) {
  const client = fakeClient({
    references: (async () => ({ outgoing: [], incoming: projects.map((id) => ({ kind: "Project", id, name: id })) })) as never,
  });
  return render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SetUpNext />
      </QueryClientProvider>
    </ClientProvider>,
  ).container;
}

// A planned service is defined in full and saved, and only then does its
// walk ask for the project that sets it up, now or later (TAXONOMY.md D30).
describe("the end of a planned service's walk", () => {
  beforeEach(() => {
    store = { id: "checks", spec: { status: "planned" }, staged: false };
  });

  it("asks to start the project now or later, once the service is saved", async () => {
    mount([]);
    const now = await screen.findByRole("link", { name: new RegExp(sc.now) });
    expect(now.getAttribute("href")).toBe("/projects/new?operation=checks");
    expect(screen.getByRole("link", { name: sc.later }).getAttribute("href")).toBe("/operations");
  });

  it("leads back to the project whose placeholder it was defined from", async () => {
    sessionStorage.setItem("cartograph:waiting:checks", "rollout");
    try {
      mount([]);
      const back = await screen.findByRole("link", { name: new RegExp(sc.back) });
      expect(back.getAttribute("href")).toContain("resolve=checks");
      expect(screen.queryByRole("link", { name: new RegExp(sc.now) })).toBeNull();
    } finally {
      sessionStorage.clear();
    }
  });

  it("asks for the save first while the service is a draft", async () => {
    store.staged = true;
    mount([]);
    expect(await screen.findByText(sc.saveFirst)).toBeTruthy();
    expect(screen.queryByRole("link", { name: new RegExp(sc.now) })).toBeNull();
  });

  it("asks nothing of a running service, or one a project already sets up", async () => {
    store.spec = {};
    let c = mount([]);
    await new Promise((r) => setTimeout(r, 0));
    expect(c.querySelector('[data-cartograph-region="set-up-next"]')).toBeNull();
    store.spec = { status: "planned" };
    c = mount(["rollout"]);
    await new Promise((r) => setTimeout(r, 20));
    expect(c.querySelector('[data-cartograph-region="set-up-next"]')).toBeNull();
  });
});
