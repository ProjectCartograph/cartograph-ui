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
const cc = copy.projects.components;

// The workspace's graph: a shared platform, a programme that lists this
// project, and a project that already depends on it.
const node = (kind: "Project" | "Programme", id: string, name: string, extra: object = {}) => ({
  kind, id, name, months: 0, dependents: 0, critical: false, inLoop: false, mostDependedOn: false, ...extra,
});
const graph = {
  nodes: [
    node("Project", "p1", "Depot checks", { dependents: 2 }),
    node("Project", "platform", "Data platform", { months: 4, dependents: 3, mostDependedOn: true, critical: true }),
    node("Project", "upstream", "Grading app", { months: 6 }),
    node("Programme", "quality", "Quality programme"),
  ],
  edges: [
    { from: { kind: "Programme", id: "quality" }, to: { kind: "Project", id: "p1" } },
    { from: { kind: "Project", id: "upstream" }, to: { kind: "Project", id: "p1" } },
  ],
  loops: [],
  criticalPath: [],
  criticalMonths: 0,
};
const candidates = [
  { kind: "Project", id: "p1", name: "Depot checks", allowed: false, reason: "It cannot depend on itself." },
  { kind: "Project", id: "platform", name: "Data platform", allowed: true },
  { kind: "Project", id: "upstream", name: "Grading app", allowed: false, reason: "It already depends on this one, so this would make a loop." },
  { kind: "Programme", id: "quality", name: "Quality programme", allowed: false, reason: "It already depends on this one, so this would make a loop." },
];

function mount(spec: object) {
  const project = { apiVersion: "cartograph/v1", kind: "Project", metadata: { id: "p1", name: "Depot checks" }, spec: { team: "t1", summary: {}, ...spec } };
  render(
    <ClientProvider client={fakeClient({ get: async () => ({ version: { number: 0 }, manifest: project, yaml: "" }) as never, list: async () => [] as never, saveWorking: async () => undefined, goalTree: async () => ({ levels: [], nodes: [] }) as never, components: async () => graph as never, linkCandidates: async () => candidates as never })}>
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
  it("asks what it depends on, then about a portfolio", async () => {
    mount({});
    const deps = await screen.findByRole("radiogroup", { name: cc.ask });
    expect(screen.queryByRole("radiogroup", { name: gc.askPortfolio })).toBeNull();
    fireEvent.click(within(deps).getByRole("radio", { name: gc.no }));
    expect(await screen.findByRole("radiogroup", { name: gc.askPortfolio })).toBeInTheDocument();
  });

  // An answer picked by mistake is taken back by picking it again.
  it("takes an answer back when it is picked again", async () => {
    mount({});
    const deps = await screen.findByRole("radiogroup", { name: cc.ask });
    const no = within(deps).getByRole("radio", { name: gc.no });
    fireEvent.click(no);
    expect(no).toHaveAttribute("aria-checked", "true");
    fireEvent.click(no);
    expect(no).toHaveAttribute("aria-checked", "false");
    expect(within(deps).getByRole("radio", { name: gc.yes })).toHaveAttribute("aria-checked", "false");
  });

  it("opens on what it already depends on, and offers to walk it again", async () => {
    mount({ components: [{ kind: "Project", id: "platform" }] });
    const deps = await screen.findByRole("radiogroup", { name: cc.ask });
    expect(within(deps).getByRole("radio", { name: gc.yes })).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByRole("checkbox", { name: cc.dependOn("Data platform") })).toHaveAttribute("data-state", "checked");
    expect(screen.getByText(gc.walkAgain).closest("a")).toHaveAttribute("data-search", JSON.stringify({ from: "p1" }));
  });

  // A row that would close a loop stays in the table, says why, and
  // cannot be ticked; what depends on this project is read back below.
  it("says why a row cannot be added, and shows what uses this project", async () => {
    mount({});
    fireEvent.click(within(await screen.findByRole("radiogroup", { name: cc.ask })).getByRole("radio", { name: gc.yes }));
    const loop = await screen.findByRole("checkbox", { name: cc.dependOn("Grading app") });
    expect(loop).toBeDisabled();
    expect(loop.closest("tr")).toHaveTextContent("would make a loop");
    const usedBy = document.querySelector('[data-slot="used-by"]') as HTMLElement;
    expect(usedBy).toHaveTextContent("Quality programme");
    expect(usedBy).toHaveTextContent("Grading app");
  });

  it("adds a component by ticking its row, and asks what is needed from it", async () => {
    mount({});
    fireEvent.click(within(await screen.findByRole("radiogroup", { name: cc.ask })).getByRole("radio", { name: gc.yes }));
    const platform = await screen.findByRole("checkbox", { name: cc.dependOn("Data platform") });
    fireEvent.click(platform);
    expect(platform).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("textbox", { name: cc.why("Data platform") })).toHaveAttribute("data-cartograph-field", "/spec/components/0/why");
    expect(screen.getByRole("radio", { name: cc.picked(1) })).toBeInTheDocument();
  });

  it("holds what it is about to the limit, and counts toward it", async () => {
    mount({ summary: { about: "One checklist." } });
    const about = await screen.findByLabelText(copy.projects.align.aboutLabel);
    expect(about).toHaveAttribute("maxLength", "300");
    expect(screen.getByText(gc.aboutCount(14, 300))).toBeInTheDocument();
  });
});
