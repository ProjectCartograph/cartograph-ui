/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ClientProvider } from "@/client/context";
import { fakeClient } from "@/client/fake";
import { copy } from "@/copy";
import { ProjectStoreProvider } from "../store";
import { AlignmentSection } from "../sections/GoalsSection";

vi.mock("@tanstack/react-router", () => ({
  useBlocker: () => undefined,
  Link: ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => <a data-search={JSON.stringify(rest.search)}>{children}</a>,
}));

const gc = copy.projects.goals;

function mount(spec: object) {
  const project = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Depot checks" }, spec: { team: "t1", summary: {}, ...spec } };
  render(
    <ClientProvider client={fakeClient({ get: async () => ({ version: { number: 0 }, manifest: project, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined, goalTree: async () => ({ levels: [], nodes: [] }) as never })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProjectStoreProvider id="p1">
          <AlignmentSection />
        </ProjectStoreProvider>
      </QueryClientProvider>
    </ClientProvider>,
  );
}

// Where a project sits is asked a question at a time, each opening the
// next once answered, and what it is about is held to the schema's limit.
describe("where a project sits", () => {
  it("asks in turn: a bigger project, then a programme, then a portfolio", async () => {
    mount({});
    const bigger = await screen.findByRole("radiogroup", { name: gc.askProject });
    expect(screen.queryByRole("radiogroup", { name: gc.askProgramme })).toBeNull();
    fireEvent.click(within(bigger).getByRole("radio", { name: gc.no }));
    const programme = await screen.findByRole("radiogroup", { name: gc.askProgramme });
    expect(screen.queryByRole("radiogroup", { name: gc.askPortfolio })).toBeNull();
    fireEvent.click(within(programme).getByRole("radio", { name: gc.no }));
    expect(await screen.findByRole("radiogroup", { name: gc.askPortfolio })).toBeInTheDocument();
  });

  it("opens on what is already answered, and offers to walk it again", async () => {
    mount({ alignment: { programmes: ["quality"] } });
    const programme = await screen.findByRole("radiogroup", { name: gc.askProgramme });
    expect(within(programme).getByRole("radio", { name: gc.yes })).toHaveAttribute("aria-checked", "true");
    expect(document.querySelector('[data-cartograph-field="/spec/alignment/programmes"]')).not.toBeNull();
    expect(screen.getByText(gc.walkAgain).closest("a")).toHaveAttribute("data-search", JSON.stringify({ from: "p1" }));
  });

  it("holds what it is about to the limit, and counts toward it", async () => {
    mount({ summary: { about: "One checklist." } });
    const about = await screen.findByLabelText(copy.projects.align.aboutLabel);
    expect(about).toHaveAttribute("maxLength", "300");
    expect(screen.getByText(gc.aboutCount(14, 300))).toBeInTheDocument();
  });
});
