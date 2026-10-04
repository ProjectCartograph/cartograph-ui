import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import type { GlossaryEntry } from "@/client/port";
import { Term } from "@/components/Term";
import { copy } from "@/copy";
import { GlossaryPage } from "../GlossaryPage";

const entries: GlossaryEntry[] = [
  { key: "purpose", kind: "Purpose", summary: "Why your organisation exists.", example: "Every member family earns a fair living." },
  { key: "goal", kind: "Goal", level: "goal", summary: "A broad aim for several years.", example: "Raise produce quality.", after: ["purpose"] },
  { key: "kpi", kind: "KPI", summary: "A number you track over time.", example: "Quality pass rate.", after: ["goal"] },
  { key: "project", kind: "Project", summary: "Work with a start and an end.", example: "Quality Check Rollout.", after: ["goal"] },
  { key: "Team", kind: "Team", summary: "A group of people who own work.", example: "Depot Network Team.", register: true },
];

function mount(children: ReactNode) {
  const client = fakeClient({ glossary: async () => entries });
  const { container } = render(
    <ClientProvider client={client}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
    </ClientProvider>,
  );
  return container;
}

describe("the glossary (TAXONOMY.md D29)", () => {
  it("defines a word behind a mark beside it: the word, a plain sentence and an example", async () => {
    mount(<Term word="kpi" />);
    fireEvent.click(await screen.findByRole("button", { name: copy.glossary.whatIs("Indicator") }));
    const entry = document.querySelector('[data-glossary-entry="kpi"]') as HTMLElement;
    expect(within(entry).getByText("Indicator")).toBeTruthy();
    expect(entry.textContent).toContain("A number you track over time.");
    expect(entry.textContent).toContain("Quality pass rate.");
  });

  it("shows nothing for a word it does not have", async () => {
    const container = mount(<Term word="nothing" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[data-slot="term-help"]')).toBeNull();
  });

  it("lists every word in the order of work: strategy, work, then the lists everything draws on", async () => {
    const container = mount(<GlossaryPage />);
    await screen.findByText("Why your organisation exists.");
    const strategy = container.querySelector('[data-cartograph-region="glossary-strategy"]') as HTMLElement;
    expect([...strategy.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Purpose", "Goal", "Indicator"]);
    expect(within(strategy).getByText(copy.glossary.comesAfter("Purpose"))).toBeTruthy();
    expect(container.querySelector('[data-cartograph-region="glossary-work"] dt')!.textContent).toBe("Project");
    expect(container.querySelector('[data-cartograph-region="glossary-registers"] dt')!.textContent).toBe("Team");
  });
});
