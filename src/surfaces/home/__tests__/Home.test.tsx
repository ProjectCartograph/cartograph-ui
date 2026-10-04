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
  Link: ({ children, to, search, params }: { children: ReactNode; to: string; search?: Record<string, string>; params?: Record<string, string> }) => {
    const path = Object.entries(params ?? {}).reduce((p, [k, v]) => p.replace(`$${k}`, v), to);
    return <a href={search ? `${path}?${new URLSearchParams(search)}` : path}>{children}</a>;
  },
}));

const hc = copy.home;

function mount(u: Understanding) {
  const understand = vi.fn(async () => u);
  const client = fakeClient({
    understand,
    order: async () => ({ stages: [], registers: [] }),
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

// What a person types is matched against the record, and the next step
// follows: open what says it, or define something new through New's
// questions (engine docs/adr/0023).
describe("home", () => {
  it("shows what already says it, and leads to it", async () => {
    const { understand } = mount({
      available: true,
      matches: [{ kind: "Goal", id: "faults-found-before-dispatch", name: "Faults are found before produce leaves the depot", level: "outcome", likelihood: 0.94, by: "model" }],
    });
    const region = await waitForAnswer();
    expect(understand).toHaveBeenCalledWith("Faults are caught before produce leaves the depot. Mostly at intake.");
    expect(region.textContent).toContain(hc.already);
    expect(region.textContent).toContain(hc.byMeaning);
    const open = within(region).getAllByRole("link").find((a) => a.textContent?.startsWith(`${hc.open} Faults`));
    expect(open?.getAttribute("href")).toBe("/goals/faults-found-before-dispatch");
    expect(within(region).getByRole("link", { name: hc.defineNew }).getAttribute("href")).toBe("/new");
  });

  it("leads to New's questions when nothing says it", async () => {
    mount({ available: true, matches: [] });
    const region = await waitForAnswer();
    expect(region.textContent).toContain(hc.nothing);
    expect(region.textContent).toContain(hc.defineHint);
    expect(within(region).getByRole("link", { name: new RegExp(hc.defineNew) }).getAttribute("href")).toBe("/new");
  });

  it("without a decision model, shows what shares its words", async () => {
    mount({ available: false, matches: [{ kind: "Gap", id: "g1", name: "Faults are found after dispatch", likelihood: 0.4, by: "words" }] });
    const region = await waitForAnswer();
    expect(region.textContent).toContain(hc.sameWords);
    expect(region.textContent).toContain(hc.byWords);
    // A match by words alone never leads: New does.
    expect(within(region).getByRole("link", { name: new RegExp(hc.defineNew) }).getAttribute("href")).toBe("/new");
  });
});

async function waitForAnswer(): Promise<HTMLElement> {
  await screen.findByText((_, el) => el?.getAttribute("data-cartograph-region") === "home-answer");
  return document.querySelector('[data-cartograph-region="home-answer"]') as HTMLElement;
}
