/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { DefinitionStoreProvider } from "@/definition/store";
import { HoldsSection } from "../sections/HoldsSection";
import { blankPortfolioSpec } from "../types";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const fc = copy.portfolios;

/** A programme and a project that name the portfolio, one project that
 * does not, and a decision already made on the programme. */
const work: Record<string, { id: string; name: string; spec: Record<string, unknown> }[]> = {
  Programme: [{ id: "quality", name: "Quality Improvement Programme", spec: { portfolios: ["invest"] } }],
  Project: [
    { id: "app", name: "Member app", spec: { alignment: { portfolios: ["invest"] } } },
    { id: "other", name: "Other project", spec: { alignment: {} } },
  ],
  Portfolio: [],
};

const list = vi.fn();
const get = vi.fn();
const saveVersion = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  list.mockImplementation(async (kind: string) => (work[kind] ?? []).map((w) => ({ id: w.id, name: w.name })));
  get.mockImplementation(async (kind: string, id: string) => {
    if (kind === "Portfolio") return { version: { number: 1 }, manifest: { metadata: { id: "invest", name: "Investment" }, spec: { aim: "Fund", leadTeam: "t1" } } };
    if (kind === "PortfolioDecisions")
      return { version: { number: 1 }, manifest: { spec: { portfolio: "invest", decisions: [{ kind: "Programme", id: "quality", priority: 1, decision: "invest" }] } } };
    const row = (work[kind] ?? []).find((w) => w.id === id);
    return row ? { version: { number: 1 }, manifest: { spec: row.spec } } : {};
  });
  saveVersion.mockResolvedValue({ number: 2 });
});

// A portfolio decides on what names it, and only that: its decisions are
// saved as one file beside it (engine TAXONOMY.md D32).
describe("a portfolio's holdings and decisions", () => {
  it("lists what names it, and saves a decision for each in its own file", async () => {
    render(
      <ClientProvider client={fakeClient({ list, get, saveVersion })}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DefinitionStoreProvider kind="Portfolio" id="invest" blank={blankPortfolioSpec}>
            <HoldsSection />
          </DefinitionStoreProvider>
        </QueryClientProvider>
      </ClientProvider>,
    );
    const app = (await screen.findByText("Member app")).closest("li") as HTMLElement;
    expect(screen.getByText("Quality Improvement Programme")).toBeInTheDocument();
    expect(screen.queryByText("Other project")).toBeNull();
    // The programme's saved decision is shown; the project has none yet.
    const quality = screen.getByText("Quality Improvement Programme").closest("li") as HTMLElement;
    await waitFor(() => expect(within(quality).getByRole("radio", { name: new RegExp(fc.decisions.invest) })).toHaveAttribute("data-state", "on"));
    expect(within(app).getByText(fc.undecided)).toBeInTheDocument();

    fireEvent.click(within(app).getByRole("radio", { name: new RegExp(fc.decisions.hold) }));
    fireEvent.change(within(app).getByLabelText(fc.reason), { target: { value: "Wait for the pilot" } });
    fireEvent.click(screen.getByRole("button", { name: fc.saveDecisions }));

    await waitFor(() => expect(saveVersion).toHaveBeenCalledTimes(1));
    const [kind, id, manifest] = saveVersion.mock.calls[0] as [string, string, { spec: { portfolio: string; decisions: { kind: string; id: string; decision: string; reason?: string }[] } }];
    expect([kind, id]).toEqual(["PortfolioDecisions", "invest-decisions"]);
    expect(manifest.spec.portfolio).toBe("invest");
    expect(manifest.spec.decisions.map((d) => [d.kind, d.id, d.decision, d.reason])).toEqual([
      ["Programme", "quality", "invest", undefined],
      ["Project", "app", "hold", "Wait for the pilot"],
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent(fc.saved);
  });
});
