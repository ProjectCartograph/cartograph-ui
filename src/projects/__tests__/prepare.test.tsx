/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import flow from "../../../contract/flows/project.flow.json";
import portfolioFlow from "../../../contract/flows/portfolio.flow.json";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { Prepare } from "../Prepare";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  getRouteApi: () => ({ useSearch: () => ({}) }),
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
  useBlocker: () => undefined,
}));

const pc = copy.prepare;
const prepared = (flow as { spec: { prepare: { kind: string; level?: string }[] } }).spec.prepare;

function mount(kind: "Project" | "Programme" | "Portfolio" = "Project") {
  const client = fakeClient({
    list: async () => [],
    goalTree: async () => ({ levels: ["Goal", "Objective", "Outcome"], nodes: [] }),
    relevant: async () => ({ available: false, matches: [] }),
  });
  return render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Prepare kind={kind} />
      </QueryClientProvider>
    </ClientProvider>,
  );
}

beforeEach(() => {
  navigate.mockReset();
  sessionStorage.clear();
});

// What the walk picks from is prepared first, in the contract's order;
// one is open at a time, any can be skipped, and the project can be
// started at any point with the idea it began from (TAXONOMY.md D34).
describe("before a project's walk", () => {
  it("lists what the walk picks from, in the contract's order, the first one open", () => {
    const { container } = mount();
    const rows = [...container.querySelectorAll("[data-prepare]")].map((el) => el.getAttribute("data-prepare"));
    expect(rows).toEqual(prepared.map((p) => p.kind + (p.level ? `/${p.level}` : "")));
    expect(container.querySelector("[data-open]")?.getAttribute("data-prepare")).toBe("Team");
  });

  it("moves to the next on skipping, and back to any on opening it", () => {
    const { container } = mount();
    fireEvent.click(within(container.querySelector("[data-open]") as HTMLElement).getByRole("button", { name: pc.skip }));
    expect(container.querySelector("[data-open]")?.getAttribute("data-prepare")).toBe(prepared[1].kind);
    expect(screen.getByText(pc.progress(1, prepared.length))).toBeInTheDocument();
    fireEvent.click(container.querySelector('[data-prepare="Team"]') as HTMLElement);
    expect(container.querySelector("[data-open]")?.getAttribute("data-prepare")).toBe("Team");
  });

  it("prepares a programme or a portfolio from its own list, and starts its own walk", () => {
    const { container, unmount } = mount("Portfolio");
    const rows = [...container.querySelectorAll("[data-prepare]")].map((el) => el.getAttribute("data-prepare"));
    expect(rows).toEqual((portfolioFlow as { spec: { prepare: { kind: string }[] } }).spec.prepare.map((p) => p.kind));
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(pc.start(pc.what.Portfolio)) })[0]);
    expect(navigate).toHaveBeenCalledWith({ to: "/portfolios/new", search: {} });
    unmount();
  });

  it("starts the project whenever asked, carrying the idea as what it is about", () => {
    mount();
    fireEvent.change(screen.getByLabelText(pc.ideaLabel), { target: { value: "Train depot staff on one checklist. Then roll it out." } });
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(pc.start(pc.what.Project)) })[0]);
    expect(navigate).toHaveBeenCalledWith({ to: "/projects/new", search: { about: "Train depot staff on one checklist." } });
  });
});
