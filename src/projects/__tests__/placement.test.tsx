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
  // What it depends on, what uses it and its portfolios are shown as
  // themselves; nothing asks a yes or no question to reach them.
  it("shows each relation with its count, and asks nothing", async () => {
    mount({});
    const depends = await screen.findByText(cc.dependsOnLabel);
    expect(depends.closest('[data-slot="depends-on"]')).toHaveTextContent(cc.dependsOnNone);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    const usedBy = await screen.findByText("Quality programme");
    expect(usedBy.closest('[data-slot="used-by"]')).toHaveTextContent("Grading app");
    expect(screen.getByText(gc.walkAgain).closest("a")).toHaveAttribute("data-search", JSON.stringify({ from: "p1" }));
  });

  it("opens on what it already depends on", async () => {
    mount({ components: [{ kind: "Project", id: "platform" }] });
    const chip = await screen.findByText("Data platform");
    expect(chip.closest("[data-relation-item]")).toHaveAttribute("data-relation-item", "Project/platform");
    expect(screen.getByRole("button", { name: cc.removeDependency("Data platform") })).toBeInTheDocument();
  });

  // The picker is a table: a row that would close a loop stays in it,
  // says why, and cannot be ticked; ticking a row adds the chip and asks
  // what is needed from it.
  it("adds a dependency from the table, and says why a row cannot be added", async () => {
    mount({});
    fireEvent.click(await screen.findByRole("button", { name: cc.addDependency }));
    const loop = await screen.findByRole("checkbox", { name: cc.dependOn("Grading app") });
    expect(loop).toBeDisabled();
    expect(loop.closest("tr")).toHaveTextContent("would make a loop");
    const platform = screen.getByRole("checkbox", { name: cc.dependOn("Data platform") });
    fireEvent.click(platform);
    expect(platform).toHaveAttribute("data-state", "checked");
    expect(screen.getByRole("textbox", { name: cc.why("Data platform") })).toHaveAttribute("data-cartograph-field", "/spec/components/0/why");
  });

  it("holds what it is about to the limit, and counts toward it", async () => {
    mount({ summary: { about: "One checklist." } });
    const about = await screen.findByLabelText(copy.projects.align.aboutLabel);
    expect(about).toHaveAttribute("maxLength", "300");
    expect(screen.getByText(gc.aboutCount(14, 300))).toBeInTheDocument();
  });
});
