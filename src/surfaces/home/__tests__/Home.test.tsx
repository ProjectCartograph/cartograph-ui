import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { Understanding } from "@/client/port";
import { copy } from "@/copy";
import { Home } from "../Home";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search, params, ...rest }: { children: ReactNode; to: string; search?: Record<string, string>; params?: Record<string, string> } & Record<string, unknown>) => {
    const path = Object.entries(params ?? {}).reduce((p, [k, v]) => p.replace(`$${k}`, v), to);
    const query = search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "";
    return (
      <a href={path + query} {...(rest as object)}>
        {children}
      </a>
    );
  },
}));

const hc = copy.home;

function mount(u: Understanding) {
  const understand = vi.fn(async () => u);
  const client = fakeClient({
    understand,
    order: async () => ({
      stages: [
        { key: "gap", kind: "Gap", state: "waiting", waiting: ["kpi"], count: 0 },
        { key: "outcome", kind: "Goal", level: "outcome", state: "ready", count: 2 },
      ],
      next: "kpi",
      registers: [],
    }),
    glossary: async () => [],
  });
  const { container } = render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Home />
      </QueryClientProvider>
    </ClientProvider>,
  );
  const box = screen.getByRole("textbox", { name: hc.title });
  fireEvent.change(box, { target: { value: "Faults are caught before produce leaves the depot. Mostly at intake." } });
  fireEvent.keyDown(box, { key: "Enter" });
  return { container, understand };
}

// What a person types is matched against the record, and the flows
// likeliest to define it are offered, each opening with what was typed:
// never New, and never one flow chosen for the person (engine
// docs/adr/0023).
describe("home", () => {
  it("opens what already says it, and still offers the flows", async () => {
    const { understand } = mount({
      available: true,
      matches: [{ kind: "Goal", id: "faults-found-before-dispatch", name: "Faults are found before produce leaves the depot", level: "outcome", likelihood: 0.94, by: "model" }],
      routes: [{ key: "outcome", kind: "Goal", level: "outcome", likelihood: 0.9 }],
    });
    const region = await waitForAnswer();
    expect(understand).toHaveBeenCalledWith("Faults are caught before produce leaves the depot. Mostly at intake.");
    expect(region.textContent).toContain(hc.already);
    const open = within(region).getAllByRole("link").find((a) => a.textContent?.startsWith(`${hc.open} Faults`));
    expect(open?.getAttribute("href")).toBe("/goals/faults-found-before-dispatch");
    expect(region.textContent).toContain(hc.defineNew);
  });

  it("offers the three likeliest flows, each opening with what was typed", async () => {
    mount({
      available: true,
      matches: [],
      routes: [
        { key: "gap", kind: "Gap", likelihood: 0.9 },
        { key: "outcome", kind: "Goal", level: "outcome", likelihood: 0.8 },
        { key: "kpi", kind: "KPI", likelihood: 0.6 },
      ],
    });
    const region = await waitForAnswer();
    expect(region.textContent).toContain(hc.nothing);
    const offered = [...region.querySelectorAll("[data-slot='flows'] a")].map((a) => a.getAttribute("data-flow"));
    expect(offered).toEqual(["gap", "outcome", "kpi"]);
    const name = "Faults are caught before produce leaves the depot";
    const href = (flow: string) => region.querySelector(`a[data-flow='${flow}']`)?.getAttribute("href");
    expect(href("gap")).toBe(`/gaps/new?${new URLSearchParams({ name })}`);
    expect(href("outcome")).toBe(`/goals?${new URLSearchParams({ add: "outcome", name })}`);
    expect(href("kpi")).toBe(`/kpis?${new URLSearchParams({ add: "1", name })}`);
    // Where the flow stands in the order of work is said, not enforced.
    expect(region.querySelector("a[data-flow='gap']")?.textContent).toContain(hc.needsFirst("indicator"));
    // The others are one step away, and New only when the person is unsure.
    expect(within(region).getByRole("list", { name: hc.somethingElse }).querySelectorAll("a")).toHaveLength(7);
    expect(within(region).getByRole("link", { name: hc.notSure }).getAttribute("href")).toBe("/new");
  });

  it("without a decision model, shows what shares its words and offers every flow", async () => {
    mount({ available: false, matches: [{ kind: "Gap", id: "g1", name: "Faults are found after dispatch", likelihood: 0.4, by: "words" }], routes: [] });
    const region = await waitForAnswer();
    expect(region.textContent).toContain(hc.sameWords);
    expect(region.textContent).toContain(hc.defineAsNoModel);
    // A match by words alone never leads.
    expect(within(region).queryByRole("link", { name: new RegExp(`^${hc.open} `) })).toBeNull();
    const chips = within(region).getByRole("list", { name: hc.somethingElse }).querySelectorAll("a");
    expect(chips).toHaveLength(10);
    expect(region.querySelector("a[data-flow='kpi']")?.className).toContain("font-medium");
  });
});

async function waitForAnswer(): Promise<HTMLElement> {
  await screen.findByText((_, el) => el?.getAttribute("data-cartograph-region") === "home-answer");
  return document.querySelector('[data-cartograph-region="home-answer"]') as HTMLElement;
}
