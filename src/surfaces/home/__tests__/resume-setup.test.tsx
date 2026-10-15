/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { markOnboarded } from "@/onboarding/firstRun";
import { Home } from "../Home";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, to, ...rest }: { children: ReactNode; to: string } & Record<string, unknown>) => (
    <a href={to} {...(rest as object)}>
      {children}
    </a>
  ),
}));

const hc = copy.home;

beforeEach(() => {
  navigate.mockReset();
  localStorage.clear();
});

function mount(named: boolean, goals: boolean) {
  const client = fakeClient({
    settings: async () => ({ goalLevels: ["Goal", "Objective", "Outcome"], purpose: named ? { organisation: "Riverside Growers" } : undefined }) as never,
    goalTree: async () => ({ levels: [], nodes: goals ? [{ id: "g1", name: "Goal", level: "goal", children: [] }] : [], unplaced: [] }) as never,
    order: async () => ({ stages: [], next: "", registers: [] }) as never,
    glossary: async () => [],
  });
  render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Home />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// The welcome walk opens by itself once, on a new workspace; put off, it
// waits on Home until the workspace is set up (#128).
describe("setting up the workspace from Home", () => {
  it("opens the walk on a new workspace not yet offered it", async () => {
    mount(false, false);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/welcome", replace: true }));
  });

  it("offers to resume the walk once it was put off, while the workspace is not set up", async () => {
    markOnboarded();
    mount(true, false);
    const tile = await screen.findByRole("link", { name: hc.resumeSetupLabel });
    expect(tile).toHaveAttribute("href", "/welcome");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers nothing once the workspace is set up", async () => {
    markOnboarded();
    mount(true, true);
    await waitFor(() => expect(screen.getByRole("textbox", { name: hc.title })).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("link", { name: hc.resumeSetupLabel })).toBeNull();
  });
});
